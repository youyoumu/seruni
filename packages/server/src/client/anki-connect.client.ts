import fs from "node:fs/promises";
import path from "node:path";

import type { DB } from "#/db";
import type { DBClient } from "#/db/db.client";
import type { FFmpegExec } from "#/exec/ffmpeg.exec";
import type { PythonExec } from "#/exec/python.exec";
import type { State } from "#/state/state";
import type { VadData } from "#/util/schema";
import { textHistory } from "@repo/shared/db";
import type { ServerApi } from "@repo/shared/ws";
import { format } from "date-fns";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";
import z from "zod";

import type { OBSClient } from "./obs.client";
import { ReconnectingAnkiConnect } from "./ReconnectingAnkiConnect";

class UpdateError extends Error {
  filesToDelete: string[];
  constructor(message: string, filesToDelete: string[] = []) {
    super(message);
    this.filesToDelete = filesToDelete;
  }
}

type ProcessQueueResult =
  | {
      picturePath: string;
      sentenceAudioPath: string;
      reuseMedia?: true;
      filesToDelete: string[];
    }
  | UpdateError;

export class AnkiConnectClient extends ReconnectingAnkiConnect {
  state: State;
  db: DB;
  dbClient: DBClient;
  api: ServerApi;
  processQueue = new Map<number, Promise<ProcessQueueResult>>();
  obsClient: OBSClient;
  ffmpeg: FFmpegExec;
  python: PythonExec;
  mediaDir: string | undefined;
  duplicateList = new Set<string>();

  constructor(opts: {
    logger: Logger;
    state: State;
    db: DB;
    dbClient: DBClient;
    api: ServerApi;
    obsClient: OBSClient;
    ffmpeg: FFmpegExec;
    python: PythonExec;
  }) {
    super({
      host: "http://127.0.0.1",
      port: 8765,
      logger: opts.logger.child({ name: "anki-connect-client" }),
    });
    this.state = opts.state;
    this.db = opts.db;
    this.dbClient = opts.dbClient;
    this.api = opts.api;
    this.obsClient = opts.obsClient;
    this.ffmpeg = opts.ffmpeg;
    this.python = opts.python;

    this.addListener("open", () => {
      this.state.ankiConnectConnected(true);
    });

    this.addListener("close", () => {
      this.state.ankiConnectConnected(false);
    });
  }

  #mediaDirCache = "";
  async getMediaDir(): Promise<string | Error> {
    if (this.#mediaDirCache) return this.#mediaDirCache;
    const maxRetries = 3;
    const retryDelay = 1000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return (this.#mediaDirCache = await this.client.media.getMediaDirPath());
      } catch (e) {
        if (attempt === maxRetries) {
          return e instanceof Error ? e : new Error("Failed to get media dir");
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      }
    }
    return new Error("Failed to get media dir after retries");
  }

  async updateNoteMedia({
    note,
    textHistoryId,
  }: {
    note: AnkiNote;
    textHistoryId: number;
  }): Promise<ProcessQueueResult> {
    //get history
    const now = new Date();
    const history = await this.db.query.textHistory.findFirst({
      where: eq(textHistory.id, textHistoryId),
    });
    if (!history) return new UpdateError("Failed to find text history");
    if (history.createdAt.getTime() < now.getTime() - this.state.config().obsReplayBufferDuration) {
      return new UpdateError("Text history already pass the replay buffer duration");
    }

    this.log.trace(
      {
        text: history.text,
        time: format(history.createdAt, "yyyy-MM-dd HH:mm:ss"),
      },
      "Using history",
    );

    const filesToDelete: string[] = [];
    const alreadyProcessed = this.processQueue.has(history.id);
    const { promise, resolve: resolve_ } = Promise.withResolvers<ProcessQueueResult>();
    const resolve = (result: ProcessQueueResult) => {
      resolve_(result);
      return result;
    };
    const error = (error: Error) => {
      return resolve(new UpdateError(error.message, filesToDelete));
    };
    if (!alreadyProcessed) this.processQueue.set(history.id, promise);

    // if text is already processed, reuse the media file
    if (alreadyProcessed) {
      this.log.info("Trying to reuse media files");
      const result = await this.processQueue.get(history.id);
      if (!result) return new UpdateError("Can't find process queue with id: " + history.id);
      if (result instanceof Error) return result;
      if (result) {
        this.log.trace({ ...result }, "Reusing media files");
        const updateResult = await this.updateNote({
          note,
          picturePath: result.picturePath,
          sentenceAudioPath: result.sentenceAudioPath,
        });
        if (updateResult instanceof Error) return new UpdateError(updateResult.message);
        return { ...result, reuseMedia: true };
      }
    }

    // save replay buffer
    const savedReplayPath = await this.obsClient.saveReplayBuffer();
    if (savedReplayPath instanceof Error) return error(savedReplayPath);
    filesToDelete.push(savedReplayPath);

    // calculate offset
    const fileEnd = new Date();
    const duration = await this.ffmpeg.getFileDuration(savedReplayPath);
    if (duration instanceof Error) return error(duration);

    const fileStart = new Date(fileEnd.getTime() - duration);
    const offset = Math.max(0, Math.floor(history.createdAt.getTime() - fileStart.getTime()));

    // create wav file for vad
    const audioStage1Path = await this.ffmpeg.process({
      inputPath: savedReplayPath,
      seek: offset,
      format: "wav",
    });
    if (audioStage1Path instanceof Error) return error(audioStage1Path);
    filesToDelete.push(audioStage1Path);

    // generate vad data
    const audioStage1VadData = await this.python.runSilero(audioStage1Path);
    if (audioStage1VadData instanceof Error) return error(audioStage1VadData);

    // generate audio file
    let audioStage1Duration = audioStage1VadData[audioStage1VadData.length - 1]?.end;
    if (audioStage1VadData.length === 1 && (audioStage1Duration ?? 0) < 1000) {
      audioStage1Duration = undefined;
    }
    const audioStage2PathPromise = this.ffmpeg.process({
      inputPath: audioStage1Path,
      duration: audioStage1Duration,
      format: "opus",
    });

    // generate image file
    const extraSeek = Math.max(0, Math.floor(now.getTime() - history.createdAt.getTime()));
    const imagePathPromise = this.ffmpeg.process({
      inputPath: savedReplayPath,
      seek: offset + extraSeek,
      format: "webp",
    });

    // generate audio file for editing
    const recordDurationFallbackSecond = 10;
    const audioStage3Duration =
      audioStage1VadData[audioStage1VadData.length - 1]?.end ?? recordDurationFallbackSecond;
    const offsetToLeft = 5000;
    const offsetToRight = 5000;
    const audioStage3PathPromise = this.ffmpeg.process({
      inputPath: savedReplayPath,
      seek: offset - offsetToLeft,
      duration: audioStage3Duration + offsetToLeft + offsetToRight,
      format: "opus",
    });

    const pictureFormat = this.state.config().ffmpegPictureFormat;
    // generate image file
    const imageDirPromise = this.ffmpeg.process({
      inputPath: savedReplayPath,
      seek: offset,
      duration: audioStage1Duration ?? 3000,
      format: `${pictureFormat}:multiple`,
    });

    const [audioStage3Path, imageDir] = await Promise.all([
      audioStage3PathPromise,
      imageDirPromise,
    ]);
    if (audioStage3Path instanceof Error) return error(audioStage3Path);
    if (imageDir instanceof Error) return error(imageDir);

    Promise.all([audioStage3PathPromise, imageDirPromise]).then(([audioStage3Path, imageDir]) => {
      this.insertNoteAndMedia({
        note,
        sentenceAudioPath: audioStage3Path instanceof Error ? undefined : audioStage3Path,
        sentenceAudioVadData: audioStage1VadData,
        pictureDir: imageDir instanceof Error ? undefined : imageDir,
        pictureFormat,
      });
    });

    const [audioStage2Path, imagePath] = await Promise.all([
      audioStage2PathPromise,
      imagePathPromise,
    ]);
    if (audioStage2Path instanceof Error) return error(audioStage2Path);
    if (imagePath instanceof Error) return error(imagePath);

    const updateResult = await this.updateNote({
      note,
      picturePath: imagePath,
      sentenceAudioPath: audioStage2Path,
    });
    if (updateResult instanceof Error) return error(updateResult);

    return resolve({
      sentenceAudioPath: audioStage2Path,
      picturePath: imagePath,
      filesToDelete,
    });
  }

  async insertNoteAndMedia({
    note,
    sentenceAudioPath,
    sentenceAudioVadData,
    pictureDir,
    pictureFormat,
  }: {
    note: AnkiNote;
    sentenceAudioPath?: string;
    sentenceAudioVadData: VadData;
    pictureDir?: string;
    pictureFormat: string;
  }) {
    const mediaEntries: Parameters<typeof this.dbClient.insertNoteAndMedia>[0]["media"] = [];

    if (sentenceAudioPath) {
      mediaEntries.push({
        filePath: sentenceAudioPath,
        type: "sentenceAudio",
        vadData: sentenceAudioVadData,
      });
    }

    if (pictureDir) {
      const files = await fs.readdir(pictureDir);
      const imageFiles = files
        .filter((f) => f.endsWith(`.${pictureFormat}`))
        .map((file) => ({
          filePath: path.join(pictureDir, file),
          type: "picture" as const,
          vadData: undefined,
        }));
      mediaEntries.push(...imageFiles);
    }

    if (mediaEntries.length > 0) {
      await this.dbClient.insertNoteAndMedia({
        noteId: note.noteId,
        media: mediaEntries,
      });
    }
  }

  async updateNote({
    note,
    picturePath,
    sentenceAudioPath,
    overwrite = false,
    nsfw,
  }: {
    note: AnkiNote;
    picturePath: string | undefined | null;
    sentenceAudioPath: string | undefined | null;
    overwrite?: boolean;
    nsfw?: boolean;
  }) {
    nsfw = nsfw ?? isNsfw(note);
    let tags = [...note.tags];
    const appName = this.state.appName;
    if (!tags.includes(appName)) tags.push(appName);
    if (!isNsfw(note) && nsfw) tags.push("NSFW");
    if (isNsfw(note) && !nsfw) {
      tags = tags.filter((tag) => tag.toLowerCase() !== "nsfw");
    }

    this.log.debug({ noteId: note.noteId, picturePath, sentenceAudioPath, tags }, "Updating note");

    const backupResult = await this.backupNoteMedia(note, {
      isBackupPicture: !!picturePath,
      isBackupSentenceAudio: !!sentenceAudioPath,
    });
    if (backupResult instanceof Error) return backupResult;

    try {
      await this.client?.note.updateNote({
        note: {
          id: note.noteId,
          fields: {
            ...(picturePath && overwrite && { [this.state.config().ankiPictureField]: "" }),
            ...(sentenceAudioPath &&
              overwrite && {
                [this.state.config().ankiSentenceAudioField]: "",
              }),
          },
          ...(picturePath && {
            picture: [
              {
                path: picturePath,
                filename: path.basename(picturePath),
                fields: [this.state.config().ankiPictureField],
              },
            ],
          }),
          ...(sentenceAudioPath && {
            audio: [
              {
                path: sentenceAudioPath,
                filename: path.basename(sentenceAudioPath),
                fields: [this.state.config().ankiSentenceAudioField],
              },
            ],
          }),
          tags,
        },
      });
      return note;
    } catch (e) {
      return e instanceof Error ? e : new Error("Error when updating note");
    }
  }

  async backupNoteMedia(
    note: AnkiNote,
    { isBackupPicture = true, isBackupSentenceAudio = true } = {},
  ) {
    const ankiMediaDir = await this.getMediaDir();
    if (!ankiMediaDir || ankiMediaDir instanceof Error) return new Error("Failed to get media dir");

    const pictureFieldValue = note.fields[this.state.config().ankiPictureField]?.value ?? "";
    const sentenceAudioFieldValue =
      note.fields[this.state.config().ankiSentenceAudioField]?.value ?? "";
    const backupPicture = parseAnkiMediaPath(pictureFieldValue);
    const backupSentenceAudio = parseAnkiMediaPath(sentenceAudioFieldValue);
    const backupPictureFilePath = backupPicture
      ? path.join(ankiMediaDir, backupPicture)
      : undefined;
    const backupSentenceAudioFilePath = backupSentenceAudio
      ? path.join(ankiMediaDir, backupSentenceAudio)
      : undefined;

    const media: Array<{
      type: "picture" | "sentenceAudio";
      filePath: string;
      vadData?: VadData;
    }> = [];
    try {
      if (!backupPictureFilePath || !isBackupPicture) {
        this.log.debug("No Picture to backup");
      } else {
        await fs.access(backupPictureFilePath);
        media.push({ filePath: backupPictureFilePath, type: "picture" });
      }
    } catch (e) {
      return e instanceof Error ? e : new Error("Failed to access backupPictureFilePath");
    }
    try {
      if (!backupSentenceAudioFilePath || !isBackupSentenceAudio) {
        this.log.debug("No SentenceAudio to backup");
      } else {
        await fs.access(backupSentenceAudioFilePath);
        media.push({
          filePath: backupSentenceAudioFilePath,
          type: "sentenceAudio",
        });
      }
    } catch (e) {
      return e instanceof Error ? e : new Error("Failed to access backupSentenceAudioFilePath");
    }

    if (media.length > 0) {
      await this.dbClient.insertNoteAndMedia({ noteId: note.noteId, media });
    }
  }
}

//TODO: handle multiple media
function parseAnkiMediaPath(fieldValue: string) {
  const imageRegex = /<img\s+[^>]*src=["']([^"']+)["']/i;
  const soundRegex = /\[sound:([^\]]+)\]/i;

  const imageMatch = fieldValue.match(imageRegex);
  const soundMatch = fieldValue.match(soundRegex);

  return imageMatch?.[1] ?? soundMatch?.[1] ?? "";
}

function isNsfw(note: AnkiNote) {
  return note.tags.map((t) => t.toLowerCase()).includes("nsfw");
}

async function rm(filePath: string) {
  try {
    return await fs.rm(filePath);
  } catch (e) {
    return e instanceof Error ? e : new Error("Error when removing file");
  }
}

export const zAnkiNote = z.object({
  cards: z.array(z.number()),
  fields: z.record(z.string(), z.object({ order: z.number(), value: z.string() })),
  mod: z.number(),
  modelName: z.string(),
  noteId: z.number(),
  profile: z.string(),
  tags: z.array(z.string()),
});

export type AnkiNote = z.infer<typeof zAnkiNote>;
