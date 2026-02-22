import path from "node:path";

import type { DB } from "#/db";
import type { FFmpegExec } from "#/exec/ffmpeg.exec";
import type { PythonExec } from "#/exec/python.exec";
import type { State } from "#/state/state";
import { textHistory } from "@repo/shared/db";
import type { ServerApi } from "@repo/shared/ws";
import { format } from "date-fns";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";
import z from "zod";

import type { OBSClient } from "./obs.client";
import { ReconnectingAnkiConnect } from "./ReconnectingAnkiConnect";

type ProcessQueueResult =
  | {
      picturePath: string;
      sentenceAudioPath: string;
      reuseMedia?: true;
    }
  | Error;

export class AnkiConnectClient extends ReconnectingAnkiConnect {
  state: State;
  db: DB;
  api: ServerApi;
  processQueue = new Map<number, Promise<ProcessQueueResult>>();
  obsClient: OBSClient;
  ffmpeg: FFmpegExec;
  python: PythonExec;

  constructor(opts: {
    logger: Logger;
    state: State;
    db: DB;
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

  // TODO: clean savedReplayPath and audioStage1Path
  async updateNoteMedia({
    note,
    textHistoryId,
  }: {
    note: AnkiNote;
    textHistoryId: number;
  }): Promise<ProcessQueueResult> {
    //get history
    // TODO: configurable
    const REPLAY_BUFFER_DURATION = 5 * 60 * 1000;
    const now = new Date();
    const history = await this.db.query.textHistory.findFirst({
      where: eq(textHistory.id, textHistoryId),
    });
    if (!history) return Error("Failed to find text history");
    if (history.createdAt.getTime() < now.getTime() - REPLAY_BUFFER_DURATION) {
      return Error("Text history already pass the replay buffer duration");
    }

    this.log.trace(
      {
        text: history.text,
        time: format(history.createdAt, "yyyy-MM-dd HH:mm:ss"),
      },
      "Using history",
    );

    const alreadyProcessed = this.processQueue.has(history.id);
    const { promise, resolve: resolve_ } = Promise.withResolvers<ProcessQueueResult>();
    const resolve = (result: ProcessQueueResult) => {
      resolve_(result);
      return result;
    };
    if (!alreadyProcessed) this.processQueue.set(history.id, promise);

    // if text is already processed, reuse the media file
    if (alreadyProcessed) {
      this.log.info("Trying to reuse media files");
      const result = await this.processQueue.get(history.id);
      if (!result) return Error("Can't find process queue with id: " + history.id);
      if (result instanceof Error) return result;
      if (result) {
        this.log.trace({ ...result }, "Reusing media files");
        const updateResult = await this.updateNote({
          note,
          picturePath: result.picturePath,
          sentenceAudioPath: result.sentenceAudioPath,
        });
        if (updateResult instanceof Error) return updateResult;
        return { ...result, reuseMedia: true };
      }
    }

    // save replay buffer
    const savedReplayPath = await this.obsClient.saveReplayBuffer();
    if (savedReplayPath instanceof Error) return resolve(savedReplayPath);

    // calculate offset
    const fileEnd = new Date();
    const duration = await this.ffmpeg.getFileDuration(savedReplayPath);
    if (duration instanceof Error) return resolve(duration);
    const fileStart = new Date(fileEnd.getTime() - duration);
    const offset = Math.max(0, Math.floor(history.createdAt.getTime() - fileStart.getTime()));

    // create wav file for vad
    const audioStage1Path = await this.ffmpeg.process({
      inputPath: savedReplayPath,
      seek: offset,
      format: "wav",
    });
    if (audioStage1Path instanceof Error) return resolve(audioStage1Path);

    // generate vad data
    const audioStage1VadData = await this.python.runSilero(audioStage1Path);
    if (audioStage1VadData instanceof Error) return resolve(audioStage1VadData);
    let lastEnd = audioStage1VadData[audioStage1VadData.length - 1]?.end;
    if (audioStage1VadData.length === 1 && (lastEnd ?? 0) < 1000) {
      lastEnd = undefined;
    }

    // generate audio file
    const audioStage2PathPromise = this.ffmpeg.process({
      inputPath: audioStage1Path,
      duration: lastEnd,
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
    const lastEnd2 =
      audioStage1VadData[audioStage1VadData.length - 1]?.end ?? recordDurationFallbackSecond;
    const offsetToLeft = 5000;
    const offsetToRight = 5000;
    const audioStage3PathPromise = this.ffmpeg.process({
      inputPath: savedReplayPath,
      seek: offset - offsetToLeft,
      duration: lastEnd2 + offsetToLeft + offsetToRight,
      format: "opus",
    });

    // TODO: configurable
    const imageFormat = "webp" as const;
    // generate image file
    const imageDirPromise = this.ffmpeg.process({
      inputPath: savedReplayPath,
      seek: offset,
      //TODO: configurable
      duration: lastEnd ?? 3000,
      format: `${imageFormat}:multiple`,
    });

    const [audioStage3Path, imageDir] = await Promise.all([
      audioStage3PathPromise,
      imageDirPromise,
    ]);
    if (audioStage3Path instanceof Error) return resolve(audioStage3Path);
    if (imageDir instanceof Error) return resolve(imageDir);

    // TODO:
    //
    // Promise.all([audioStage3PathPromise, imageDirPromise]).then(
    //   async ([audioStage3Path, imageDir]) => {
    //     const insertNoteAndMedia = mainDB().insertNoteAndMedia;
    //     const mediaEntries: Parameters<typeof insertNoteAndMedia>[0]["media"] = [];
    //
    //     if (audioStage3Path) {
    //       mediaEntries.push({
    //         filePath: audioStage3Path,
    //         type: "sentenceAudio",
    //         vadData: audioStage1VadData,
    //       });
    //     }
    //
    //     if (imageDir) {
    //       try {
    //         const files = await readdir(imageDir);
    //         const imageFiles = files
    //           .filter((f) => f.endsWith(`.${imageFormat}`))
    //           .map((file) => ({
    //             filePath: join(imageDir, file),
    //             type: "picture" as const,
    //             vadData: undefined,
    //           }));
    //         mediaEntries.push(...imageFiles);
    //       } catch (e) {
    //         this.log.error({ error: e }, "Failed to read images from directory:");
    //       }
    //     }
    //
    //     if (mediaEntries.length > 0) {
    //       try {
    //         await mainDB().insertNoteAndMedia({
    //           noteId: note.noteId,
    //           media: mediaEntries,
    //         });
    //       } catch (e) {
    //         this.log.error({ error: e }, "Failed to insert note and media");
    //       }
    //     }
    //   },
    // );

    const [audioStage2Path, imagePath] = await Promise.all([
      audioStage2PathPromise,
      imagePathPromise,
    ]);
    if (audioStage2Path instanceof Error) return resolve(audioStage2Path);
    if (imagePath instanceof Error) return resolve(imagePath);

    const updateResult = await this.updateNote({
      note,
      picturePath: imagePath,
      sentenceAudioPath: audioStage2Path,
    });
    if (updateResult instanceof Error) return resolve(updateResult);

    return resolve({
      sentenceAudioPath: audioStage2Path,
      picturePath: imagePath,
    });
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
    //TODO: configurable
    if (!tags.includes("Seruni")) tags.push("Seruni");
    if (!isNsfw(note) && nsfw) tags.push("NSFW");
    if (isNsfw(note) && !nsfw) {
      tags = tags.filter((tag) => tag.toLowerCase() !== "nsfw");
    }

    this.log.debug({ noteId: note.noteId, picturePath, sentenceAudioPath, tags }, "Updating note");

    //TODO:
    // await this.backupNoteMedia(note, {
    //   isBackupPicture: !!picturePath,
    //   isBackupSentenceAudio: !!sentenceAudioPath,
    // });

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
}

function isNsfw(note: AnkiNote) {
  return note.tags.map((t) => t.toLowerCase()).includes("nsfw");
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
