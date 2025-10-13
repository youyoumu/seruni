import { rm } from "node:fs/promises";
import { basename } from "node:path";
import { signal } from "alien-signals";
import { delay } from "es-toolkit";
import { sort } from "fast-sort";
import { YankiConnect } from "yanki-connect";
import { env } from "#/env";
import { logIPC } from "#/ipc";
import { config } from "#/util/config";
import { ffmpeg, getFileDuration } from "#/util/ffmpeg";
import { log } from "#/util/logger";
import { python } from "#/util/python";
import type { Status } from "./_util";
import { obsClient } from "./obs";
import { textractorClient } from "./textractor";

type TextUuidQueueResult =
  | {
      sentenceAudioPath: string | undefined | null;
      picturePath: string | undefined | null;
    }
  | undefined;

hmr.log(import.meta.url);

export function createAnkiClient() {
  class AnkiClient {
    client: YankiConnect | undefined;
    lastAddedNote: number | undefined;
    reconnecting = false;
    retryCount = 0;
    maxRetries = Infinity;
    maxDelay = 16000;
    retryTimer: NodeJS.Timeout | null = null;
    monitorStarted = false;
    status: Status = "disconnected";
    textUuidQueue: Record<string, Promise<TextUuidQueueResult>> = {};
    mediaDir: string | undefined;

    async prepare() {
      await this.connect();
    }

    async connect() {
      if (this.reconnecting) return;
      this.status = "connecting";
      this.reconnecting = false;

      try {
        this.client = new YankiConnect({
          port: config.store.anki.ankiConnectPort,
        });
        // Try to verify connection
        await this.client.deck.deckNames();
        this.lastAddedNote = await this.getLastAddedNote();
        this.mediaDir = await this.client?.media.getMediaDirPath();
        this.retryCount = 0;
        this.status = "connected";
        log.info(
          `Connected to AnkiConnect on port ${config.store.anki.ankiConnectPort}`,
        );
        if (this.monitorStarted) this.monitor();
      } catch (error) {
        log.error(
          { error },
          `Failed to connect to AnkiConnect on port ${config.store.anki.ankiConnectPort}`,
        );
        this.handleDisconnect();
      }
    }

    handleDisconnect() {
      if (this.reconnecting) return;
      this.reconnecting = true;
      this.scheduleReconnect();
    }

    scheduleReconnect() {
      if (this.retryCount >= this.maxRetries) {
        log.error(
          "Max retries reached. Stopping AnkiConnect reconnection attempts.",
        );
        return;
      }

      const delayMs = Math.min(this.maxDelay, 1000 * 2 ** this.retryCount);
      log.info(`Reconnecting to AnkiConnect in ${delayMs / 1000} seconds...`);
      this.retryCount++;

      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => {
        this.reconnecting = false;
        this.connect();
      }, delayMs);
    }

    async getLastAddedNote() {
      if (!this.client) throw new Error("Anki client not connected");
      const res = await this.client.note.findNotes({ query: "added:1" });
      return sort(res ?? []).desc()[0];
    }

    async monitor() {
      this.monitorStarted = true;
      while (true) {
        if (!this.client) {
          log.warn("Anki client unavailable, pausing...");
          this.handleDisconnect();
          break;
        }

        try {
          const lastAddedNote = await this.getLastAddedNote();
          if (
            lastAddedNote &&
            (!this.lastAddedNote || lastAddedNote > this.lastAddedNote)
          ) {
            this.lastAddedNote = lastAddedNote;
            try {
              const noteInfo = ((await this.client?.note.notesInfo({
                notes: [lastAddedNote],
              })) ?? [])[0];
              log.debug({ noteInfo }, "noteInfo");
              //TODO: display note info on toast

              logIPC().sendToastPromise(
                (async () => {
                  const result = await this.handleNewNote(lastAddedNote);
                  return {
                    success: {
                      title: "Note Has Been Updated",
                      description: `Updated note with id: ${lastAddedNote}.${result?.reuseMedia ? " Reusing media files from previous note." : ""}`,
                    },
                  };
                })(),
                {
                  loading: {
                    title: "Processing New Note...",
                    description: `Detected new note with id: ${lastAddedNote}.`,
                  },
                  error: {
                    title: "Error",
                    description: "Failed to process new note",
                  },
                },
              );
            } catch (e) {
              log.error({ error: e }, "Failed to handle new note");
            }
          }
        } catch (error) {
          log.error({ error }, "Failed to get last added note");
          this.handleDisconnect();
          break;
        }

        await delay(1000);
      }
    }

    close() {
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.client = undefined;
      this.reconnecting = false;
    }

    rm(path: string) {
      rm(path, { force: true });
    }

    async handleNewNote(noteId: number) {
      //get history
      const now = new Date();
      const history = sort(textractorClient().history)
        .desc(({ time }) => time)
        .find(({ time, uuid }) => {
          return true;
          // return time <= now && uuid === miningIPC().textUuid;
        });
      if (!history) {
        throw new Error("Failed to find history");
      }
      log.debug(
        {
          text: history?.text,
          time: history?.time?.toLocaleDateString(),
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
          log.info("Trying to reuse media files");
          const result = await this.textUuidQueue[history.uuid];
          if (result) {
            log.debug(
              {
                ...result,
              },
              "Reusing media files",
            );
            await this.updateNoteMedia({
              noteId,
              picturePath: result.picturePath,
              sentenceAudioPath: result.sentenceAudioPath,
            });
            await this.client?.graphical.guiEditNote({ note: noteId });
            return {
              reuseMedia: true,
            };
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
        let durationSeconds: number;
        try {
          durationSeconds = await getFileDuration(savedReplayPath);
        } catch (e) {
          throw new Error("Failed to get duration", { cause: e });
        }
        const fileStart = new Date(fileEnd.getTime() - durationSeconds * 1000);
        const offsetMs = Math.max(
          0,
          Math.floor(history.time.getTime() - fileStart.getTime()),
        );

        // create wav file for vad
        try {
          audioStage1Path = await ffmpeg({
            inputPath: savedReplayPath,
            seekMs: offsetMs,
            format: "wav",
          });
        } catch (e) {
          throw new Error("Failed to extract audio", { cause: e });
        }

        // generate vad data
        let audioStage1VadData: {
          start: number;
          end: number;
        }[];
        try {
          audioStage1VadData = JSON.parse(
            await python.runEntry([audioStage1Path]),
          );
        } catch (e) {
          throw new Error("Failed to extract audio VAD data", { cause: e });
        }
        let lastEnd = audioStage1VadData[audioStage1VadData.length - 1]?.end;
        if (audioStage1VadData.length === 1 && (lastEnd ?? 0) < 1.5) {
          lastEnd = undefined;
        }

        // generate audio file
        const audioStage2PathPromise = (() => {
          if (lastEnd) {
            try {
              return ffmpeg({
                inputPath: audioStage1Path,
                durationMs: lastEnd * 1000,
                format: "opus",
              });
            } catch (e) {
              throw new Error("Failed to crop audio", { cause: e });
            }
          }
        })();

        // generate image file
        const imagePathPromise = (() => {
          try {
            const extraSeek = Math.max(
              0,
              Math.floor(now.getTime() - history.time.getTime()),
            );
            return ffmpeg({
              inputPath: savedReplayPath,
              seekMs: offsetMs + extraSeek,
              format: "webp",
            });
          } catch (e) {
            throw new Error("Failed to extract image", { cause: e });
          }
        })();

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
        if (savedReplayPath) this.rm(savedReplayPath);
        if (audioStage1Path) this.rm(audioStage1Path);
      }
    }

    async updateNoteMedia({
      noteId,
      picturePath,
      sentenceAudioPath,
    }: {
      noteId: number;
      picturePath: string | undefined | null;
      sentenceAudioPath: string | undefined | null;
    }) {
      await this.client?.note.updateNoteFields({
        note: {
          id: noteId,
          fields: {},
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
      await this.client?.note.addTags({
        notes: [noteId],
        tags: env.APP_NAME,
      });
    }
  }

  return new AnkiClient();
}

export const ankiClient = signal(createAnkiClient());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
  });
  import.meta.hot.dispose(() => {});
}
