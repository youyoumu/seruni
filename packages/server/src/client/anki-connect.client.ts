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
import { textHistory as textHistoryTable, type TextHistory } from "@repo/shared/db";
import type { AnkiNote } from "@repo/shared/schema";
import type { ServerApi } from "@repo/shared/ws";
import { eq } from "drizzle-orm";
import { last, memoize, retry, uniq } from "es-toolkit";
import type { Logger } from "pino";

import type { OBSClient } from "./obs.client";
import { ReconnectingAnkiConnect } from "./ReconnectingAnkiConnect";

export class AnkiConnectClient extends ReconnectingAnkiConnect {
  mediaDir: string | undefined;
  duplicateList = new Set<string>();
  #createMediaCache = new Map();

  constructor(
    public logger: Logger,
    public state: State,
    public db: DB,
    public dbClient: DBClient,
    public api: ServerApi,
    public obsClient: OBSClient,
    public ffmpeg: FFmpegExec,
    public python: PythonExec,
  ) {
    const url = new URL(state.config().ankiConnectAddress);
    const port = parseInt(url.port);
    url.port = "";
    super({
      host: url.origin,
      port: port,
      logger: logger.child({ name: "anki-connect-client" }),
    });

    this.addListener("open", () => {
      this.state.ankiConnectConnected(true);
    });

    this.addListener("close", () => {
      this.state.ankiConnectConnected(false);
    });
  }

  getMediaDir = memoize(this.#getMediaDir.bind(this));
  async #getMediaDir(): Promise<R.Result<string, Error>> {
    return R.try({
      try: () => retry(this.client.media.getMediaDirPath, { delay: 1000, retries: 3 }),
      catch: anyCatch("Failed to get media dir"),
    });
  }

  async preUpdateNoteMedia({ noteId, textHistoryId }: { noteId: number; textHistoryId: number }) {
    return await R.pipe(
      this.getNote(noteId),
      R.andThrough((note) => this.validateField(note)),
      R.inspectError((e) => {
        this.api.push.toast({
          title: "Error when updating note",
          description: e.message,
          variant: "danger",
        });
      }),
      R.andThen((note) => {
        const expression = this.getExpression(note);
        const reuseMedia = this.#createMediaCache.has(textHistoryId);
        //TODO: desc action etc
        return this.api.toastPromise(() => this.updateNoteMedia({ note, textHistoryId }), {
          loading: `Processing new note: ${expression}`,
          //TODO: open note in anki with uid toast action
          success: () => {
            return `Note has been updated: ${expression}${reuseMedia ? " (♻  media)" : ""}`;
          },
          error: (e) => {
            const error = Array.isArray(e) ? (e[0] ?? new Error("Unknown Error")) : e;
            return `Failed to process new note: ${error.message}`;
          },
        });
      }),
      R.inspectError((e) => {
        this.log.error(e);
      }),
    );
  }

  async updateNoteMedia({ note, textHistoryId }: { note: AnkiNote; textHistoryId: number }) {
    const now = new Date();
    const text = await this.db.query.textHistory.findFirst({
      where: eq(textHistoryTable.id, textHistoryId),
    });
    if (!text) return anyFail("Failed to find text history");
    if (text.createdAt.getTime() < now.getTime() - this.state.config().obsReplayBufferDuration) {
      return anyFail("Text history already pass the replay buffer duration");
    }

    return R.pipe(
      this.createMedia({ textHistory: text, now, note }),
      R.andThen(({ picture, sentenceAudio }) => this.updateNote({ note, picture, sentenceAudio })),
    );
  }

  createMedia = memoize(this.#createMedia.bind(this), {
    getCacheKey: ({ textHistory }) => textHistory.id,
    cache: this.#createMediaCache,
  });

  async #createMedia(params: {
    now: Date;
    textHistory: TextHistory;
    note: AnkiNote;
  }): Promise<R.Result<{ picture: string; sentenceAudio: string | null }, Error | Error[]>> {
    const { textHistory, now, note } = params;
    const filesToDelete: string[] = [];
    const pictureFormat = this.state.config().ffmpegPictureFormat;

    return await R.pipe(
      R.do(),
      // save replay buffer
      R.bind("replay", () => this.obsClient.saveReplayBuffer()),
      R.map(({ replay }) => ({ replay: { path: replay, savedAt: new Date() } })),
      R.andThrough(({ replay }) => R.succeed(filesToDelete.push(replay.path))),

      // calculate seek
      R.bind("replayDuration", ({ replay }) => this.ffmpeg.getFileDuration(replay.path)),
      R.bind("seek", ({ replayDuration, replay }) => {
        const offset = new Date(replay.savedAt.getTime() - replayDuration);
        const seek = Math.max(0, textHistory.createdAt.getTime() - offset.getTime());
        return R.succeed(seek);
      }),

      // create wav file for vad
      R.bind("audioWav", ({ seek, replay }) => {
        return this.ffmpeg.process({
          inputPath: replay.path,
          seek: seek,
          format: "wav",
        });
      }),

      // generate vad data
      R.bind("audioVadData", ({ audioWav }) => this.python.runSilero(audioWav)),
      R.bind("audioDuration", ({ audioVadData }) => {
        let audioDuration = last(audioVadData)?.end;
        if (audioVadData.length === 1 && (audioDuration ?? 0) < 1000) audioDuration = undefined;
        return R.succeed(audioDuration);
      }),

      R.bind("media", ({ audioWav, audioDuration, replay, seek }) => {
        // generate sentence audio
        const sentenceAudio = audioDuration
          ? this.ffmpeg.process({ inputPath: audioWav, duration: audioDuration, format: "opus" })
          : R.succeed(null);

        // generate picture
        const extraSeek = Math.max(0, Math.floor(now.getTime() - textHistory.createdAt.getTime()));
        const picture = this.ffmpeg.process({
          inputPath: replay.path,
          // get screenshot of when addNote happen instead of textHistory createdAt
          seek: seek + extraSeek,
          format: "webp",
        });

        return R.collect({ sentenceAudio, picture });
      }),

      R.inspectError(() => filesToDelete.forEach((file) => safeRm(file))),
      R.inspect(({ audioVadData, replay, seek, audioDuration }) => {
        // generate audio file for editing
        const durationFallback = 10;
        const duration = last(audioVadData)?.end ?? durationFallback;
        const offsetToLeft = 5000;
        const offsetToRight = 5000;
        const sentenceAudioEdit = this.ffmpeg.process({
          inputPath: replay.path,
          seek: seek - offsetToLeft,
          duration: duration + offsetToLeft + offsetToRight,
          format: "opus",
        });

        // generate picture files for editing
        const pictureEditDir = this.ffmpeg.process({
          inputPath: replay.path,
          seek: seek,
          duration: audioDuration ?? 3000,
          format: `${pictureFormat}:multiple`,
        });

        void R.pipe(
          R.collect({ sentenceAudioEdit, pictureEditDir }),
          R.andThrough(({ pictureEditDir, sentenceAudioEdit }) => {
            const result = this.insertNoteAndMedia({
              note,
              sentenceAudioPath: sentenceAudioEdit,
              sentenceAudioVadData: audioVadData,
              pictureDir: pictureEditDir,
              pictureFormat,
            });
            return R.succeed(result);
          }),
          R.inspect(() => filesToDelete.forEach((file) => safeRm(file))),
          R.inspectError(() => filesToDelete.forEach((file) => safeRm(file))),
        );
      }),

      R.andThen(({ media: { sentenceAudio, picture } }) => {
        return R.succeed({ sentenceAudio, picture });
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
    picture,
    sentenceAudio,
    overwrite = false,
    nsfw,
  }: {
    note: AnkiNote;
    picture: string | undefined | null;
    sentenceAudio: string | undefined | null;
    overwrite?: boolean;
    nsfw?: boolean;
  }): Promise<R.Result<null, Error>> {
    nsfw = nsfw ?? isNoteNsfw(note);
    let tags = [...note.tags];
    tags.push(this.state.appName);
    if (nsfw) tags.push("NSFW");
    if (!nsfw) tags = tags.filter((tag) => tag.toLowerCase() !== "nsfw");
    tags = uniq(tags);

    this.log.debug(
      { noteId: note.noteId, picturePath: picture, sentenceAudio, tags },
      "Updating note",
    );
    const backupResult = await this.backupNoteMedia(note);
    if (R.isFailure(backupResult)) return R.fail(backupResult.error);
    const updateNote = R.try({
      try: () => {
        return this.client.note.updateNote({
          note: {
            id: note.noteId,
            fields: {
              ...(picture && overwrite && { [this.state.config().ankiPictureField]: "" }),
              ...(sentenceAudio &&
                overwrite && { [this.state.config().ankiSentenceAudioField]: "" }),
            },
            ...(picture && {
              picture: [
                {
                  path: picture,
                  filename: path.basename(picture),
                  fields: [this.state.config().ankiPictureField],
                },
              ],
            }),
            ...(sentenceAudio && {
              audio: [
                {
                  path: sentenceAudio,
                  filename: path.basename(sentenceAudio),
                  fields: [this.state.config().ankiSentenceAudioField],
                },
              ],
            }),
            tags,
          },
        });
      },
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
      media.push({ filePath: sentenceAudioPath.value, type: "sentenceAudio" });
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
