import fs from "node:fs/promises";
import path from "node:path";

import type { DB } from "#/db";
import type { DBClient, MediaList } from "#/db/db.client";
import type { FFmpegExec } from "#/exec/ffmpeg.exec";
import type { PythonExec } from "#/exec/python.exec";
import type { State } from "#/state/state";
import { safeAccess, safeRm } from "#/util/fs";
import { anyFail, anyCatch } from "#/util/result";
import type { VadData } from "#/util/schema";
import { R } from "@praha/byethrow";
import { textHistory as textHistoryTable } from "@repo/shared/db";
import type { ServerApi } from "@repo/shared/ws";
import { format } from "date-fns";
import { eq } from "drizzle-orm";
import { delay, uniq } from "es-toolkit";
import type { Logger } from "pino";
import z from "zod";

import type { OBSClient } from "./obs.client";
import { ReconnectingAnkiConnect } from "./ReconnectingAnkiConnect";

class QueueError extends Error {
  filesToDelete: string[];
  constructor(message: string, filesToDelete: string[] = [], options: ErrorOptions = {}) {
    super(message, options);
    this.filesToDelete = filesToDelete;
  }

  static fail(error: Error | R.Result<unknown, Error> | string, filesToDelete: string[] = []) {
    if (error instanceof Error)
      return R.fail(new QueueError(error.message, filesToDelete, { cause: error }));
    if (typeof error !== "string" && R.isFailure(error))
      return R.fail(new QueueError(error.error.message, filesToDelete, { cause: error }));
    return R.fail(new QueueError(String(error), filesToDelete));
  }
}

type ProcessQueueResult = {
  picturePath: string;
  sentenceAudioPath: string;
  reuseMedia?: true;
  filesToDelete: string[];
};

export class AnkiConnectClient extends ReconnectingAnkiConnect {
  state: State;
  db: DB;
  dbClient: DBClient;
  api: ServerApi;
  processQueue = new Map<number, Promise<R.Result<ProcessQueueResult, QueueError>>>();
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
  async getMediaDir(): Promise<R.Result<string, Error>> {
    if (this.#mediaDirCache) return R.succeed(this.#mediaDirCache);
    const maxRetries = 3;
    const retryDelay = 1000;
    const getMediaDirPath = R.fn({
      try: () => this.client.media.getMediaDirPath(),
      catch: anyCatch("Failed to get media dir"),
    });
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await getMediaDirPath();
      if (R.isSuccess(result)) return R.succeed((this.#mediaDirCache = result.value));
      if (attempt === maxRetries) return R.fail(result.error);
      await delay(retryDelay * attempt);
    }
    return anyFail("Failed to get media dir after retries");
  }

  async preUpdateNoteMedia({
    noteId,
    textHistoryId,
  }: {
    noteId: number;
    textHistoryId: number;
  }): Promise<R.Result<undefined, Error>> {
    const note = await this.getNote(noteId);
    if (R.isFailure(note)) return R.fail(note.error);
    const expression = this.getExpression(note.value);
    const validated = this.validateField(note.value);
    if (R.isFailure(validated)) return R.fail(validated.error);

    //TODO: title description action etc
    this.api.toastPromise(
      async () => {
        const updateResult = await this.updateNoteMedia({
          note: note.value,
          textHistoryId,
        });
        if (R.isFailure(updateResult)) {
          updateResult.error.filesToDelete.forEach((file: string) => safeRm(file));
          throw updateResult.error;
        }
        updateResult.value.filesToDelete.forEach((file: string) => safeRm(file));
        return updateResult.value;
      },
      {
        loading: `Processing new note: ${expression}`,
        //TODO: open note in anki with uid toast action
        success: (r) => `Note has been updated: ${expression}${r.reuseMedia ? " (♻  media)" : ""}`,
        error: (e) => `Failed to process new note: ${e.message}`,
      },
    );
    return R.succeed(undefined);
  }

  async updateNoteMedia({
    note,
    textHistoryId,
  }: {
    note: AnkiNote;
    textHistoryId: number;
  }): Promise<R.Result<ProcessQueueResult, QueueError>> {
    // get history
    const now = new Date();
    const text = await this.db.query.textHistory.findFirst({
      where: eq(textHistoryTable.id, textHistoryId),
    });
    if (!text) return QueueError.fail("Failed to find text history");
    if (text.createdAt.getTime() < now.getTime() - this.state.config().obsReplayBufferDuration) {
      return QueueError.fail("Text history already pass the replay buffer duration");
    }

    this.log.debug(
      { text: text.text, time: format(text.createdAt, "yyyy-MM-dd HH:mm:ss") },
      "Using history",
    );

    const filesToDelete: string[] = [];
    const { promise, resolve: resolve_ } =
      Promise.withResolvers<R.Result<ProcessQueueResult, QueueError>>();
    const resolve = (result: R.Result<ProcessQueueResult, QueueError>) => {
      resolve_(result);
      return result;
    };
    const resolveErr = (error: Error) => {
      return resolve(QueueError.fail(error, filesToDelete));
    };
    const alreadyProcessed = this.processQueue.has(text.id);
    if (!alreadyProcessed) this.processQueue.set(text.id, promise);

    // if text is already processed, reuse the media file
    if (alreadyProcessed) {
      this.log.info("Trying to reuse media files");
      const result = await this.processQueue.get(text.id);
      if (!result) return QueueError.fail(`Can't find process queue with id ${text.id}`);
      if (R.isFailure(result)) return R.fail(result.error);
      if (R.isSuccess(result)) {
        this.log.debug({ ...result.value }, "Reusing media files");
        const updateResult = await this.updateNote({
          note,
          picturePath: result.value.picturePath,
          sentenceAudioPath: result.value.sentenceAudioPath,
        });
        if (R.isFailure(updateResult)) return QueueError.fail(updateResult);
        return R.succeed({ ...result.value, reuseMedia: true });
      }
    }

    // save replay buffer
    const savedReplayPath = await this.obsClient.saveReplayBuffer();
    if (R.isFailure(savedReplayPath)) return resolveErr(savedReplayPath.error);
    filesToDelete.push(savedReplayPath.value);

    // calculate offset
    const fileEnd = new Date();
    const duration = await this.ffmpeg.getFileDuration(savedReplayPath.value);
    if (R.isFailure(duration)) return resolveErr(duration.error);

    const fileStart = new Date(fileEnd.getTime() - duration.value);
    const offset = Math.max(0, Math.floor(text.createdAt.getTime() - fileStart.getTime()));

    // create wav file for vad
    const audioStage1Path = await this.ffmpeg.process({
      inputPath: savedReplayPath.value,
      seek: offset,
      format: "wav",
    });

    if (R.isFailure(audioStage1Path)) return resolveErr(audioStage1Path.error);
    filesToDelete.push(audioStage1Path.value);

    // generate vad data
    const audioStage1VadData = await this.python.runSilero(audioStage1Path.value);
    if (R.isFailure(audioStage1VadData)) return resolveErr(audioStage1VadData.error);
    let audioStage1Duration = audioStage1VadData.value[audioStage1VadData.value.length - 1]?.end;
    if (audioStage1VadData.value.length === 1 && (audioStage1Duration ?? 0) < 1000) {
      audioStage1Duration = undefined;
    }

    // generate audio file
    const audioStage2PathPromise = this.ffmpeg.process({
      inputPath: audioStage1Path.value,
      duration: audioStage1Duration,
      format: "opus",
    });

    // generate picture file
    const extraSeek = Math.max(0, Math.floor(now.getTime() - text.createdAt.getTime()));
    const imagePathPromise = this.ffmpeg.process({
      inputPath: savedReplayPath.value,
      seek: offset + extraSeek,
      format: "webp",
    });

    // generate audio file for editing
    const recordDurationFallbackSecond = 10;
    const audioStage3Duration =
      audioStage1VadData.value[audioStage1VadData.value.length - 1]?.end ??
      recordDurationFallbackSecond;
    const offsetToLeft = 5000;
    const offsetToRight = 5000;
    const audioStage3PathPromise = this.ffmpeg.process({
      inputPath: savedReplayPath.value,
      seek: offset - offsetToLeft,
      duration: audioStage3Duration + offsetToLeft + offsetToRight,
      format: "opus",
    });

    const pictureFormat = this.state.config().ffmpegPictureFormat;
    // generate picture file
    const imageDirPromise = this.ffmpeg.process({
      inputPath: savedReplayPath.value,
      seek: offset,
      duration: audioStage1Duration ?? 3000,
      format: `${pictureFormat}:multiple`,
    });

    Promise.all([audioStage3PathPromise, imageDirPromise]).then(([audioStage3Path, imageDir]) => {
      this.insertNoteAndMedia({
        note,
        sentenceAudioPath: R.isSuccess(audioStage3Path) ? audioStage3Path.value : undefined,
        sentenceAudioVadData: audioStage1VadData.value,
        pictureDir: R.isSuccess(imageDir) ? imageDir.value : undefined,
        pictureFormat,
      });
    });

    const [audioStage2Path, imagePath] = await Promise.all([
      audioStage2PathPromise,
      imagePathPromise,
    ]);
    if (R.isFailure(audioStage2Path)) return resolveErr(audioStage2Path.error);
    if (R.isFailure(imagePath)) return resolveErr(imagePath.error);

    const updateResult = await this.updateNote({
      note,
      picturePath: imagePath.value,
      sentenceAudioPath: audioStage2Path.value,
    });
    if (R.isFailure(updateResult)) return resolveErr(updateResult.error);

    return resolve(
      R.succeed({
        sentenceAudioPath: audioStage2Path.value,
        picturePath: imagePath.value,
        filesToDelete,
      }),
    );
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
    const mediaList: MediaList = [];

    if (sentenceAudioPath) {
      mediaList.push({
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
      mediaList.push(...imageFiles);
    }

    if (mediaList.length > 0) {
      await this.dbClient.insertNoteAndMedia({
        noteId: note.noteId,
        media: mediaList,
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
  }): Promise<R.Result<null, Error>> {
    nsfw = nsfw ?? isNoteNsfw(note);
    let tags = [...note.tags];
    tags.push(this.state.appName);
    if (nsfw) tags.push("NSFW");
    if (!nsfw) tags = tags.filter((tag) => tag.toLowerCase() !== "nsfw");
    tags = uniq(tags);

    this.log.debug({ noteId: note.noteId, picturePath, sentenceAudioPath, tags }, "Updating note");
    const backupResult = await this.backupNoteMedia(note);
    if (R.isFailure(backupResult)) return R.fail(backupResult.error);
    const updateNote = R.try({
      try: () =>
        this.client.note.updateNote({
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
        }),
      catch: anyCatch("Error when updating note"),
    });

    return updateNote;
  }

  async backupNoteMedia(note: AnkiNote): Promise<R.Result<null, Error>> {
    const ankiMediaDir = await this.getMediaDir();
    if (R.isFailure(ankiMediaDir)) return R.fail(ankiMediaDir.error);

    const pictureFieldValue = note.fields[this.state.config().ankiPictureField]?.value ?? "";
    const sentenceAudioFieldValue =
      note.fields[this.state.config().ankiSentenceAudioField]?.value ?? "";
    const picturePath = await this.getAnkiMediaPath(pictureFieldValue);
    const sentenceAudioPath = await this.getAnkiMediaPath(sentenceAudioFieldValue);

    const media: MediaList = [];
    if (R.isSuccess(picturePath) && R.isSuccess(await safeAccess(picturePath.value))) {
      media.push({ filePath: picturePath.value, type: "picture" });
    }
    if (R.isSuccess(sentenceAudioPath) && R.isSuccess(await safeAccess(sentenceAudioPath.value))) {
      media.push({
        filePath: sentenceAudioPath.value,
        type: "sentenceAudio",
      });
    }

    if (media.length > 0) {
      return await this.dbClient.insertNoteAndMedia({ noteId: note.noteId, media });
    }
    return R.succeed(null);
  }

  async getNote(noteId: number): Promise<R.Result<AnkiNote, Error>> {
    const notesInfo = R.try({
      try: () => this.client.note.notesInfo({ notes: [noteId] }),
      catch: anyCatch("Failed to get note with notesInfo"),
    });
    const notes = await notesInfo;
    if (R.isFailure(notes)) return R.fail(notes.error);
    const note = notes.value[0];
    if (!note) return anyFail("Can't find note with index 0");
    return R.succeed(note);
  }

  getExpression(note: AnkiNote | undefined) {
    const expression = note?.fields[this.state.config().ankiExpressionField]?.value ?? "";
    return expression;
  }

  validateField(note: AnkiNote) {
    const expressionField = note.fields[this.state.config().ankiExpressionField];
    const pictureField = note.fields[this.state.config().ankiPictureField];
    const sentenceAudioField = note.fields[this.state.config().ankiSentenceAudioField];

    if (!expressionField) return anyFail("Invalid Expression field");
    if (!pictureField) return anyFail("Invalid Picture field");
    if (!sentenceAudioField) return anyFail("Invalid Sentence Audio field");
    return R.succeed({ expressionField, pictureField, sentenceAudioField });
  }

  //TODO: handle multiple media
  async getAnkiMediaPath(fieldValue: string): Promise<R.Result<string, Error>> {
    const ankiMediaDir = await this.getMediaDir();
    if (R.isFailure(ankiMediaDir)) return R.fail(ankiMediaDir.error);

    const imageRegex = /<img\s+[^>]*src=["']([^"']+)["']/i;
    const soundRegex = /\[sound:([^\]]+)\]/i;

    const imageMatch = fieldValue.match(imageRegex);
    const soundMatch = fieldValue.match(soundRegex);

    if (imageMatch?.[1]) return R.succeed(path.join(ankiMediaDir.value, imageMatch?.[1]));
    if (soundMatch?.[1]) return R.succeed(path.join(ankiMediaDir.value, soundMatch?.[1]));

    return anyFail("Can't find media path from field value");
  }
}

function isNoteNsfw(note: AnkiNote) {
  return note.tags.map((t) => t.toLowerCase()).includes("nsfw");
}

//TODO: move to shared
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
