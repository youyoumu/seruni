import { readdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import type { ClientStatus } from "@repo/preload/ipc";
import { format } from "date-fns";
import { delay } from "es-toolkit";
import { sort } from "fast-sort";
import { YankiConnect } from "yanki-connect";
import { mainDB } from "#/db/main";
import { env } from "#/env";
import { logIPC } from "#/ipc/log";
import { ffmpeg } from "#/runner/ffmpeg";
import { python } from "#/runner/python";
import { type BusEvents, bus } from "#/util/bus";
import { config } from "#/util/config";
import { logWithNamespace } from "#/util/logger";
import type { AnkiNote, VadData } from "#/util/schema";
import { obsClient } from "./obs";
import { textractorClient } from "./textractor";

type TextUuidQueueResult =
  | {
      sentenceAudioPath: string | undefined | null;
      picturePath: string | undefined | null;
    }
  | undefined;

const AnkiClient_ = class AnkiClient {
  log = logWithNamespace("AnkiConnect");
  client: YankiConnect | undefined;
  lastAddedNote: number | undefined;
  reconnecting = false;
  retryCount = 0;
  maxDelay = 16000;
  retryTimer: NodeJS.Timeout | null = null;
  status: ClientStatus = "disconnected";
  selectedTextUuid: string | undefined;
  textUuidQueue: Record<string, Promise<TextUuidQueueResult>> = {};
  mediaDir: string | undefined;
  //TODO: reactivity?
  port = config.store.anki.ankiConnectPort;
  #abortController = new AbortController();

  register() {
    this.log.trace("Registering event listeners");
    const listener = ({ noteId }: BusEvents["anki:handleNewNote"]) => {
      this.preHandleNewNote(noteId);
    };
    bus.on("anki:handleNewNote", listener);
    this.#abortController.signal.addEventListener("abort", () => {
      bus.off("anki:handleNewNote", listener);
    });
  }

  unregister() {
    this.log.trace("Unregistering event listeners");
    this.#abortController.abort();
  }

  async connect() {
    if (this.reconnecting) return;
    this.status = "connecting";

    try {
      this.client = new YankiConnect({
        port: config.store.anki.ankiConnectPort,
      });
      // check if anki is running
      await this.client.miscellaneous.version();
      this.lastAddedNote = await this.getLastAddedNote();
      this.mediaDir = await this.client?.media.getMediaDirPath();
      this.retryCount = 0;
      this.status = "connected";
      this.log.info(`Connected on port ${config.store.anki.ankiConnectPort}`);
      this.monitor();
    } catch {
      this.log.error(
        `Failed to connect on port ${config.store.anki.ankiConnectPort}`,
      );
      this.reconnect();
    }
  }

  reconnect() {
    if (this.reconnecting || this.status === "disconnected") return;
    this.reconnecting = true;
    const delay = Math.min(this.maxDelay, 1000 * 2 ** this.retryCount);
    this.log.info(`Reconnecting in ${delay / 1000} seconds...`);
    this.retryCount++;

    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.reconnecting = false;
      this.connect();
    }, delay);
  }

  async getLastAddedNote() {
    if (!this.client) throw new Error("Anki client not connected");
    const res = await this.client.note.findNotes({ query: "added:1" });
    return sort(res ?? []).desc()[0];
  }

  async monitor() {
    while (true) {
      if (!this.client) {
        this.log.warn("Client unavailable, reconnecting...");
        this.reconnect();
        break;
      }

      try {
        await this.client.miscellaneous.version();
        // const lastAddedNote = await this.getLastAddedNote();
        // if (
        //   lastAddedNote &&
        //   (!this.lastAddedNote || lastAddedNote > this.lastAddedNote)
        // ) {
        //   this.lastAddedNote = lastAddedNote;
        //   this.preHandleNewNote(lastAddedNote);
        // }
      } catch (error) {
        // log.error({ error }, "Failed to fetch last added note");
        this.log.error(
          { error },
          `Failed to connect on port ${this.port}, reconnecting...`,
        );
        this.reconnect();
        break;
      }
      await delay(1000);
    }
  }

  close() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.client = undefined;
    this.reconnecting = false;
    this.status = "disconnected";
  }

  async preHandleNewNote(noteId: number) {
    const noteInfo = await this.getNote(noteId);
    this.log.debug({ noteInfo }, "Note Info");
    const expression = AnkiClient.getExpression(noteInfo);
    //TODO: test this
    const { expressionField, pictureField, sentenceAudioField } =
      AnkiClient.validateField(noteInfo);

    logIPC().sendToastPromise(
      async () => {
        try {
          if (!expressionField) throw new Error("Invalid Expression field");
          if (!pictureField) throw new Error("Invalid Picture field");
          if (!sentenceAudioField)
            throw new Error("Invalid Sentence Audio field");
          const result = await this.handleNewNote(noteId);
          return {
            success: {
              title: `Note Has Been Updated`,
              description: `${expression}${result?.reuseMedia ? " (♻  media)" : ""}`,
            },
          };
        } catch (e) {
          this.log.error({ error: e }, "Failed to handle new note");
          return {
            error: {
              title: "Failed to handle new note",
              description: e instanceof Error ? e.message : "Unknown Error",
            },
          };
        }
      },
      {
        loading: {
          title: "Processing New Note...",
          description: `${expression}`,
        },
      },
    );
  }

  //TODO: move this out from anki client
  async handleNewNote(noteId: number) {
    //get history
    const now = new Date();
    const history = sort(textractorClient().history)
      .desc(({ time }) => time)
      .find(({ time, uuid }) => {
        return time <= now && uuid === this.selectedTextUuid;
      });
    if (!history) throw new Error("Failed to find history");

    this.log.debug(
      {
        text: history?.text,
        time: format(history?.time, "yyyy-MM-dd HH:mm:ss"),
      },
      "Using history",
    );

    const alreadyProcessed = !!this.textUuidQueue[history.uuid];
    const { promise, resolve } = Promise.withResolvers<TextUuidQueueResult>();
    if (!alreadyProcessed) {
      this.textUuidQueue[history.uuid] = promise;
    }

    let savedReplayPath: string | undefined;
    let audioStage1Path: string | undefined;

    try {
      // if text is already processed, reuse the media file
      if (alreadyProcessed) {
        this.log.info("Trying to reuse media files");
        const result = await this.textUuidQueue[history.uuid];
        if (result) {
          this.log.debug({ ...result }, "Reusing media files");
          await this.updateNoteMedia({
            noteId,
            picturePath: result.picturePath,
            sentenceAudioPath: result.sentenceAudioPath,
          });
          await this.client?.graphical.guiEditNote({ note: noteId });
          return { reuseMedia: true };
        }
      }

      // save replay buffer
      try {
        savedReplayPath = await obsClient().saveReplayBuffer();
      } catch (e) {
        throw new Error("Failed to save replay buffer", { cause: e });
      }

      // calculate offset
      const fileEnd = new Date();
      let duration: number;
      try {
        duration = await ffmpeg().getFileDuration(savedReplayPath);
      } catch (e) {
        throw new Error("Failed to get replay buffer duration duration", {
          cause: e,
        });
      }
      const fileStart = new Date(fileEnd.getTime() - duration);
      const offset = Math.max(
        0,
        Math.floor(history.time.getTime() - fileStart.getTime()),
      );

      // create wav file for vad
      try {
        audioStage1Path = await ffmpeg().process({
          inputPath: savedReplayPath,
          seek: offset,
          format: "wav",
        });
      } catch (e) {
        throw new Error("Failed to extract audio into wav format", {
          cause: e,
        });
      }

      // generate vad data
      let audioStage1VadData: VadData;
      try {
        audioStage1VadData = await python().runSilero(audioStage1Path);
      } catch (e) {
        throw new Error("Failed to extract audio VAD data", { cause: e });
      }
      let lastEnd = audioStage1VadData[audioStage1VadData.length - 1]?.end;
      if (audioStage1VadData.length === 1 && (lastEnd ?? 0) < 1000) {
        lastEnd = undefined;
      }

      // generate audio file
      const audioStage2PathPromise = (async () => {
        if (lastEnd) {
          try {
            return await ffmpeg().process({
              inputPath: audioStage1Path,
              duration: lastEnd,
              format: "opus",
            });
          } catch (e) {
            throw new Error("Failed to crop audio from processed wav audio", {
              cause: e,
            });
          }
        }
      })();

      // generate image file
      const imagePathPromise = (async () => {
        try {
          //get the frame of when we add the note instead of when we received the text
          const extraSeek = Math.max(
            0,
            Math.floor(now.getTime() - history.time.getTime()),
          );
          return await ffmpeg().process({
            inputPath: savedReplayPath,
            seek: offset + extraSeek,
            format: "webp",
          });
        } catch (e) {
          throw new Error("Failed to extract image from replay buffer", {
            cause: e,
          });
        }
      })();

      // generate audio file for editing
      const audioStage3PathPromise = (async () => {
        try {
          //TODO: configuratble
          const recordDurationFallbackSecond = 10;
          const lastEnd =
            audioStage1VadData[audioStage1VadData.length - 1]?.end ??
            recordDurationFallbackSecond;
          const offsetToLeft = 5000;
          const offsetToRight = 5000;
          return await ffmpeg().process({
            inputPath: savedReplayPath,
            seek: offset - offsetToLeft,
            duration: lastEnd + offsetToLeft + offsetToRight,
            format: "opus",
          });
        } catch (e) {
          this.log.error({ error: e }, "Failed to extract audio for editing");
        }
      })();

      const imageFormat = "webp" as const;
      // generate image file
      const imageDirPromise = (async () => {
        try {
          return await ffmpeg().process({
            inputPath: savedReplayPath,
            seek: offset,
            //TODO: configurable
            duration: lastEnd ?? 3000,
            format: `${imageFormat}:multiple`,
          });
        } catch (e) {
          this.log.error({ error: e }, "Failed to extract images for editing");
        }
      })();

      Promise.all([audioStage3PathPromise, imageDirPromise]).then(
        async ([audioStage3Path, imageDir]) => {
          const insertNoteAndMedia = mainDB().insertNoteAndMedia;
          const mediaEntries: Parameters<
            typeof insertNoteAndMedia
          >[0]["media"] = [];

          if (audioStage3Path) {
            mediaEntries.push({
              filePath: audioStage3Path,
              type: "sentenceAudio",
              vadData: audioStage1VadData,
            });
          }

          if (imageDir) {
            try {
              const files = await readdir(imageDir);
              const imageFiles = files
                .filter((f) => f.endsWith(`.${imageFormat}`))
                .map((file) => ({
                  filePath: join(imageDir, file),
                  type: "picture" as const,
                  vadData: undefined,
                }));
              mediaEntries.push(...imageFiles);
            } catch (e) {
              this.log.error(
                { error: e },
                "Failed to read images from directory:",
              );
            }
          }

          if (mediaEntries.length > 0) {
            try {
              await mainDB().insertNoteAndMedia({
                noteId,
                media: mediaEntries,
              });
            } catch (e) {
              this.log.error({ error: e }, "Failed to insert note and media");
            }
          }
        },
      );

      const [audioStage2Path, imagePath] = await Promise.all([
        audioStage2PathPromise,
        imagePathPromise,
      ]);

      await this.updateNoteMedia({
        noteId,
        picturePath: imagePath,
        sentenceAudioPath: audioStage2Path,
      });

      await this.client?.graphical.guiEditNote({ note: noteId });
      resolve({
        sentenceAudioPath: audioStage2Path,
        picturePath: imagePath,
      });
    } catch (e) {
      resolve(undefined);
      throw e;
    } finally {
      if (savedReplayPath) AnkiClient.rm(savedReplayPath);
      if (audioStage1Path) AnkiClient.rm(audioStage1Path);
    }
  }

  async updateNoteMedia({
    noteId,
    picturePath,
    sentenceAudioPath,
    overwrite = false,
  }: {
    noteId: number;
    picturePath: string | undefined | null;
    sentenceAudioPath: string | undefined | null;
    overwrite?: boolean;
  }) {
    this.log.debug(
      { noteId, picturePath, sentenceAudioPath },
      "Updating note media",
    );
    await this.client?.note.updateNoteFields({
      note: {
        id: noteId,
        fields: {
          ...(picturePath &&
            overwrite && { [config.store.anki.pictureField]: "" }),
          ...(sentenceAudioPath &&
            overwrite && {
              [config.store.anki.sentenceAudioField]: "",
            }),
        },
        ...(picturePath && {
          picture: [
            {
              path: picturePath,
              filename: basename(picturePath),
              fields: [config.store.anki.pictureField],
            },
          ],
        }),
        ...(sentenceAudioPath && {
          audio: [
            {
              path: sentenceAudioPath,
              filename: basename(sentenceAudioPath),
              fields: [config.store.anki.sentenceAudioField],
            },
          ],
        }),
      },
    });
    this.log.debug(`Adding tag ${env.APP_NAME} to note ${noteId}`);
    await this.client?.note.addTags({
      notes: [noteId],
      tags: env.APP_NAME,
    });
  }

  async getNote(noteId: number) {
    const result = ((await this.client?.note.notesInfo({
      notes: [noteId],
    })) ?? [])[0];
    if (!result) throw new Error("Note not found");
    return result;
  }

  static rm(path: string) {
    rm(path, { force: true });
  }

  static getExpression(note: AnkiNote | undefined) {
    const word = note?.fields[config.store.anki.expressionField]?.value ?? "";
    return word;
  }

  static inNsfw(note: AnkiNote) {
    return note?.tags.map((t) => t.toLowerCase()).includes("nsfw");
  }

  static validateField(note: AnkiNote) {
    const expressionField = note.fields[config.store.anki.expressionField];
    const pictureField = note.fields[config.store.anki.pictureField];
    const sentenceAudioField =
      note.fields[config.store.anki.sentenceAudioField];
    return { expressionField, pictureField, sentenceAudioField };
  }
};

export const ankiClient = hmr.module(new AnkiClient_());
export const AnkiClient = hmr.module(AnkiClient_);

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  const { ankiClient } = await hmr.register<typeof import("./anki")>(
    import.meta,
  );
  hmr.register(import.meta);
  import.meta.hot.accept(async (mod) => {
    hmr.update(import.meta, mod);
    ankiClient().register();
    await ankiClient().connect();
  });
  import.meta.hot.dispose(() => {
    ankiClient().close();
    ankiClient().unregister();
  });
}
