import fs from "node:fs/promises";
import path from "node:path";

import type { DB } from "#/db";
import type { DBClient, MediaList } from "#/db/db.client";
import type { FFmpegExec } from "#/exec/ffmpeg.exec";
import type { PythonExec } from "#/exec/python.exec";
import type { State } from "#/state/state";
import { safeAccess, safeRm } from "#/util/fs";
import type { VadData } from "#/util/schema";
import { textHistory as textHistoryTable } from "@repo/shared/db";
import type { ServerApi } from "@repo/shared/ws";
import { format } from "date-fns";
import { eq } from "drizzle-orm";
import { delay, uniq } from "es-toolkit";
import { Result, ok, err, ResultAsync, Err } from "neverthrow";
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

  static from<T = unknown>(
    error: Error | Err<unknown, Error> | string,
    filesToDelete: string[] = [],
  ): Result<T, QueueError> {
    if (error instanceof Error)
      return err(new QueueError(error.message, filesToDelete, { cause: error }));
    if (error instanceof Err)
      return err(new QueueError(error.error.message, filesToDelete, { cause: error }));
    return err(new QueueError(String(error), filesToDelete));
  }
}

function toResult<T>(result: T | Error): Result<T, Error> {
  return result instanceof Error ? err(result) : ok(result);
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
  processQueue = new Map<number, Promise<Result<ProcessQueueResult, QueueError>>>();
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
  async getMediaDir(): Promise<Result<string, Error>> {
    if (this.#mediaDirCache) return ok(this.#mediaDirCache);
    const maxRetries = 3;
    const retryDelay = 1000;
    const getMediaDirPath = ResultAsync.fromThrowable(this.client.media.getMediaDirPath, (e) => {
      return e instanceof Error ? e : Error("Failed to get media dir");
    });
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await getMediaDirPath();
      if (result.isOk()) return ok((this.#mediaDirCache = result.value));
      if (attempt === maxRetries) return err(result.error);
      await delay(retryDelay * attempt);
    }
    return err(Error("Failed to get media dir after retries"));
  }

  async preUpdateNoteMedia({
    noteId,
    textHistoryId,
  }: {
    noteId: number;
    textHistoryId: number;
  }): Promise<Result<undefined, Error>> {
    const note = await this.getNote(noteId);
    if (note.isErr()) return err(note.error);
    const expression = this.getExpression(note.value);
    const validated = this.validateField(note.value);
    if (validated.isErr()) return err(validated.error);

    //TODO: title description action etc
    this.api.toastPromise(
      async () => {
        const updateResult = await this.updateNoteMedia({
          note: note.value,
          textHistoryId,
        });
        if (updateResult.isErr()) {
          updateResult.error.filesToDelete.forEach((file) => safeRm(file));
          throw updateResult.error;
        }
        updateResult.value.filesToDelete.forEach((file) => safeRm(file));
        return updateResult.value;
      },
      {
        loading: `Processing new note: ${expression}`,
        //TODO: open note in anki with uid toast action
        success: (r) => `Note has been updated: ${expression}${r.reuseMedia ? " (♻  media)" : ""}`,
        error: (e) => `Failed to process new note: ${e.message}`,
      },
    );
    return ok(undefined);
  }

  async updateNoteMedia({
    note,
    textHistoryId,
  }: {
    note: AnkiNote;
    textHistoryId: number;
  }): Promise<Result<ProcessQueueResult, QueueError>> {
    // get history
    const now = new Date();
    const text = await this.db.query.textHistory.findFirst({
      where: eq(textHistoryTable.id, textHistoryId),
    });
    if (!text) return QueueError.from("Failed to find text history");
    if (text.createdAt.getTime() < now.getTime() - this.state.config().obsReplayBufferDuration) {
      return QueueError.from("Text history already pass the replay buffer duration");
    }

    this.log.debug(
      { text: text.text, time: format(text.createdAt, "yyyy-MM-dd HH:mm:ss") },
      "Using history",
    );

    const filesToDelete: string[] = [];
    const { promise, resolve: resolve_ } =
      Promise.withResolvers<Result<ProcessQueueResult, QueueError>>();
    const resolve = (result: Result<ProcessQueueResult, QueueError>) => {
      resolve_(result);
      return result;
    };
    const resolveErr = (error: Error) => {
      return resolve(QueueError.from(error, filesToDelete));
    };
    const alreadyProcessed = this.processQueue.has(text.id);
    if (!alreadyProcessed) this.processQueue.set(text.id, promise);

    // if text is already processed, reuse the media file
    if (alreadyProcessed) {
      this.log.info("Trying to reuse media files");
      const result = await this.processQueue.get(text.id);
      if (!result) return QueueError.from(`Can't find process queue with id ${text.id}`);
      if (result.isErr()) return err(result.error);
      if (result.isOk()) {
        this.log.debug({ ...result.value }, "Reusing media files");
        const updateResult = await this.updateNote({
          note,
          picturePath: result.value.picturePath,
          sentenceAudioPath: result.value.sentenceAudioPath,
        });
        if (updateResult.isErr()) return QueueError.from(updateResult);
        return ok({ ...result.value, reuseMedia: true });
      }
    }

    // save replay buffer
    const savedReplayPath = toResult(await this.obsClient.saveReplayBuffer());
    if (savedReplayPath.isErr()) return resolveErr(savedReplayPath.error);
    filesToDelete.push(savedReplayPath.value);

    // calculate offset
    const fileEnd = new Date();
    const duration = toResult(await this.ffmpeg.getFileDuration(savedReplayPath.value));
    if (duration.isErr()) return resolveErr(duration.error);

    const fileStart = new Date(fileEnd.getTime() - duration.value);
    const offset = Math.max(0, Math.floor(text.createdAt.getTime() - fileStart.getTime()));

    // create wav file for vad
    const audioStage1Path = toResult(
      await this.ffmpeg.process({
        inputPath: savedReplayPath.value,
        seek: offset,
        format: "wav",
      }),
    );
    if (audioStage1Path.isErr()) return resolveErr(audioStage1Path.error);
    filesToDelete.push(audioStage1Path.value);

    // generate vad data
    const audioStage1VadData = toResult(await this.python.runSilero(audioStage1Path.value));
    if (audioStage1VadData.isErr()) return resolveErr(audioStage1VadData.error);
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

    Promise.all([audioStage3PathPromise, imageDirPromise]).then(([audioStage3Path_, imageDir_]) => {
      const audioStage3Path = toResult(audioStage3Path_);
      const imageDir = toResult(imageDir_);
      this.insertNoteAndMedia({
        note,
        sentenceAudioPath: audioStage3Path.isOk() ? audioStage3Path.value : undefined,
        sentenceAudioVadData: audioStage1VadData.value,
        pictureDir: imageDir.isOk() ? imageDir.value : undefined,
        pictureFormat,
      });
    });

    const [audioStage2Path_, imagePath_] = await Promise.all([
      audioStage2PathPromise,
      imagePathPromise,
    ]);
    const audioStage2Path = toResult(audioStage2Path_);
    const imagePath = toResult(imagePath_);
    if (audioStage2Path.isErr()) return resolveErr(audioStage2Path.error);
    if (imagePath.isErr()) return resolveErr(imagePath.error);

    const updateResult = await this.updateNote({
      note,
      picturePath: imagePath.value,
      sentenceAudioPath: audioStage2Path.value,
    });
    if (updateResult.isErr()) return resolveErr(updateResult.error);

    return resolve(
      ok({
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
  }): Promise<Result<null, Error>> {
    nsfw = nsfw ?? isNoteNsfw(note);
    let tags = [...note.tags];
    tags.push(this.state.appName);
    if (nsfw) tags.push("NSFW");
    if (!nsfw) tags = tags.filter((tag) => tag.toLowerCase() !== "nsfw");
    tags = uniq(tags);

    this.log.debug({ noteId: note.noteId, picturePath, sentenceAudioPath, tags }, "Updating note");
    const backupResult = await this.backupNoteMedia(note);
    if (backupResult.isErr()) return err(backupResult.error);
    const updateNote = ResultAsync.fromThrowable(this.client.note.updateNote, (e) => {
      return e instanceof Error ? e : Error("Error when updating note");
    });

    return await updateNote({
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
  }

  async backupNoteMedia(note: AnkiNote): Promise<Result<void, Error>> {
    const ankiMediaDir = await this.getMediaDir();
    if (ankiMediaDir.isErr()) return err(ankiMediaDir.error);

    const pictureFieldValue = note.fields[this.state.config().ankiPictureField]?.value ?? "";
    const sentenceAudioFieldValue =
      note.fields[this.state.config().ankiSentenceAudioField]?.value ?? "";
    const picturePath = await this.getAnkiMediaPath(pictureFieldValue);
    const sentenceAudioPath = await this.getAnkiMediaPath(sentenceAudioFieldValue);

    const media: MediaList = [];
    if (picturePath.isOk() && (await safeAccess(picturePath.value)).isOk()) {
      media.push({ filePath: picturePath.value, type: "picture" });
    }
    if (sentenceAudioPath.isOk() && (await safeAccess(sentenceAudioPath.value)).isOk()) {
      media.push({
        filePath: sentenceAudioPath.value,
        type: "sentenceAudio",
      });
    }

    if (media.length > 0) {
      return toResult(await this.dbClient.insertNoteAndMedia({ noteId: note.noteId, media }));
    }
    return ok(undefined);
  }

  async getNote(noteId: number): Promise<Result<AnkiNote, Error>> {
    const notesInfo = ResultAsync.fromThrowable(this.client.note.notesInfo, (e) => {
      return e instanceof Error ? e : Error("Failed to get note with notesInfo");
    });
    const notes = await notesInfo({ notes: [noteId] });
    if (notes.isErr()) return err(notes.error);
    const note = notes.value[0];
    if (!note) return err(Error("Can't find note with index 0"));
    return ok(note);
  }

  getExpression(note: AnkiNote | undefined) {
    const expression = note?.fields[this.state.config().ankiExpressionField]?.value ?? "";
    return expression;
  }

  validateField(note: AnkiNote) {
    const expressionField = note.fields[this.state.config().ankiExpressionField];
    const pictureField = note.fields[this.state.config().ankiPictureField];
    const sentenceAudioField = note.fields[this.state.config().ankiSentenceAudioField];

    if (!expressionField) return err(Error("Invalid Expression field"));
    if (!pictureField) return err(Error("Invalid Picture field"));
    if (!sentenceAudioField) return err(Error("Invalid Sentence Audio field"));
    return ok({ expressionField, pictureField, sentenceAudioField });
  }

  //TODO: handle multiple media
  async getAnkiMediaPath(fieldValue: string): Promise<Result<string, Error>> {
    const ankiMediaDir = await this.getMediaDir();
    if (ankiMediaDir.isErr()) return err(ankiMediaDir.error);

    const imageRegex = /<img\s+[^>]*src=["']([^"']+)["']/i;
    const soundRegex = /\[sound:([^\]]+)\]/i;

    const imageMatch = fieldValue.match(imageRegex);
    const soundMatch = fieldValue.match(soundRegex);

    if (imageMatch?.[1]) return ok(path.join(ankiMediaDir.value, imageMatch?.[1]));
    if (soundMatch?.[1]) return ok(path.join(ankiMediaDir.value, soundMatch?.[1]));

    return err(Error("Can't find media path from field value"));
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
