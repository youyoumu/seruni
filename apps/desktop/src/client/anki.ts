import { rm } from "node:fs/promises";
import { basename } from "node:path";
import type { ClientStatus } from "@repo/preload/ipc";
import { format } from "date-fns";
import { delay } from "es-toolkit";
import { sort } from "fast-sort";
import { YankiConnect } from "yanki-connect";
import { env } from "#/env";
import { logIPC } from "#/ipc/log";
import { ffmpeg } from "#/runner/ffmpeg";
import { python } from "#/runner/python";
import { config } from "#/util/config";
import { log } from "#/util/logger";
import { obsClient } from "./obs";
import { textractorClient } from "./textractor";

hmr.log(import.meta);

type TextUuidQueueResult =
  | {
      sentenceAudioPath: string | undefined | null;
      picturePath: string | undefined | null;
    }
  | undefined;

type AnkiNote = {
  cards: number[];
  fields: Record<
    string,
    {
      order: number;
      value: string;
    }
  >;
  mod: number;
  modelName: string;
  noteId: number;
  profile: string;
  tags: string[];
};

const AnkiClient_ = class AnkiClient {
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
        `AnkiConnect: Connected on port ${config.store.anki.ankiConnectPort}`,
      );
      this.monitor();
    } catch {
      log.error(
        `AnkiConnect: Failed to connect on port ${config.store.anki.ankiConnectPort}`,
      );
      this.reconnect();
    }
  }

  reconnect() {
    if (this.reconnecting) return;
    this.reconnecting = true;
    this.scheduleReconnect();
  }

  scheduleReconnect() {
    const delayMs = Math.min(this.maxDelay, 1000 * 2 ** this.retryCount);
    log.info(`AnkiConnect: Reconnecting in ${delayMs / 1000} seconds...`);
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
    while (true) {
      if (!this.client) {
        log.warn("Anki client unavailable, pausing...");
        this.reconnect();
        break;
      }

      try {
        const lastAddedNote = await this.getLastAddedNote();
        if (
          lastAddedNote &&
          (!this.lastAddedNote || lastAddedNote > this.lastAddedNote)
        ) {
          this.lastAddedNote = lastAddedNote;
          this.preHandleNewNote(lastAddedNote);
        }
      } catch (error) {
        log.error({ error }, "Failed to fetch last added note");
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
  }

  async preHandleNewNote(noteId: number) {
    const noteInfo = await this.getNote(noteId);
    log.debug({ noteInfo }, "noteInfo");
    const expression = AnkiClient.getExpression(noteInfo);

    logIPC().sendToastPromise(
      async () => {
        try {
          const result = await this.handleNewNote(noteId);
          return {
            success: {
              title: `Note Has Been Updated`,
              description: `${expression}${result?.reuseMedia ? " (♻  media)" : ""}`,
            },
          };
        } catch (e) {
          log.error({ error: e }, "Failed to handle new note");
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

  async handleNewNote(noteId: number) {
    //get history
    const now = new Date();
    const history = sort(textractorClient().history)
      .desc(({ time }) => time)
      .find(({ time, uuid }) => {
        return time <= now && uuid === this.selectedTextUuid;
      });
    if (!history) {
      throw new Error("Failed to find history");
    }
    log.debug(
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
        durationSeconds = await ffmpeg().getFileDuration(savedReplayPath);
      } catch (e) {
        throw new Error("Failed to get replay buffer duration duration", {
          cause: e,
        });
      }
      const fileStart = new Date(fileEnd.getTime() - durationSeconds * 1000);
      const offsetMs = Math.max(
        0,
        Math.floor(history.time.getTime() - fileStart.getTime()),
      );

      // create wav file for vad
      try {
        audioStage1Path = await ffmpeg().process({
          inputPath: savedReplayPath,
          seekMs: offsetMs,
          format: "wav",
        });
      } catch (e) {
        throw new Error("Failed to extract audio into wav format", {
          cause: e,
        });
      }

      // generate vad data
      let audioStage1VadData: {
        start: number;
        end: number;
      }[];
      try {
        audioStage1VadData = JSON.parse(
          await python().runEntry([audioStage1Path]),
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
            return ffmpeg().process({
              inputPath: audioStage1Path,
              durationMs: lastEnd * 1000,
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
      const imagePathPromise = (() => {
        try {
          const extraSeek = Math.max(
            0,
            Math.floor(now.getTime() - history.time.getTime()),
          );
          return ffmpeg().process({
            inputPath: savedReplayPath,
            seekMs: offsetMs + extraSeek,
            format: "webp",
          });
        } catch (e) {
          throw new Error("Failed to extract image from replay buffer", {
            cause: e,
          });
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
      if (savedReplayPath) AnkiClient.rm(savedReplayPath);
      if (audioStage1Path) AnkiClient.rm(audioStage1Path);
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
    log.debug(
      { noteId, picturePath, sentenceAudioPath },
      "Updating note media",
    );
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
    log.debug(`Adding tag ${env.APP_NAME} to note ${noteId}`);
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
    await ankiClient().connect();
  });
  import.meta.hot.dispose(() => {
    ankiClient().close();
  });
}
