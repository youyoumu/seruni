import { unlink } from "node:fs/promises";
import { signal } from "alien-signals";
import { delay } from "es-toolkit";
import { sort } from "fast-sort";
import { YankiConnect } from "yanki-connect";
import { ffmpeg, getFileDuration } from "#/util/ffmpeg";
import { log } from "#/util/logger";
import { python } from "#/util/python";
import { obsClient } from "./obs";
import { textractorClient } from "./textractor";

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

    async prepare() {
      await this.connect();
    }

    async connect() {
      if (this.reconnecting) return;
      this.reconnecting = false;

      try {
        this.client = new YankiConnect();
        // Try to verify connection
        await this.client.deck.deckNames();
        this.lastAddedNote = await this.getLastAddedNote();
        this.retryCount = 0;
        log.info("Connected to AnkiConnect");
        if (this.monitorStarted) this.monitor();
      } catch (error) {
        log.error({ error }, "Failed to connect to AnkiConnect");
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
              this.handleNewNote(lastAddedNote);
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

    async handleNewNote(noteId: number) {
      //get history
      const now = new Date();
      const history = sort(textractorClient().history)
        .desc(({ time }) => time)
        .find(({ time, text }) => {
          //TODO: better support non latest history
          return time <= now && true;
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

      // save replay buffer
      let savedReplayPath: string | undefined;
      try {
        savedReplayPath = await obsClient().saveReplayBuffer();
      } catch {
        throw new Error("Failed to save replay buffer");
      }

      // calculate offset
      const fileEnd = new Date();
      let durationSeconds: number;
      try {
        durationSeconds = await getFileDuration(savedReplayPath);
      } catch {
        unlink(savedReplayPath).catch();
        throw new Error("Failed to get duration");
      }
      const fileStart = new Date(fileEnd.getTime() - durationSeconds * 1000);
      const offsetMs = Math.max(
        0,
        Math.floor(history.time.getTime() - fileStart.getTime()),
      );

      const noteInfo = ((await this.client?.note.notesInfo({
        notes: [noteId],
      })) ?? [])[0];
      log.debug({ noteInfo }, "noteInfo");

      // create wav file for vad
      let audioStage1Path: string;
      try {
        audioStage1Path = await ffmpeg({
          inputPath: savedReplayPath,
          seekMs: offsetMs,
          format: "wav",
        });
      } catch {
        unlink(savedReplayPath).catch();
        throw new Error("Failed to extract audio");
      }

      // generate vad data
      let audioStage1VadData: {
        start: number;
        end: number;
      }[];
      try {
        audioStage1VadData = JSON.parse(await python([audioStage1Path]));
      } catch {
        unlink(savedReplayPath).catch();
        throw new Error("Failed to extract audio VAD data");
      }
      const lastEnd = audioStage1VadData[audioStage1VadData.length - 1]?.end;
      if (!lastEnd) {
        //TODO: handle no audio
        throw new Error("No last VAD segment end time found");
      }

      // generate audio file
      let audioStage2Path: string;
      try {
        audioStage2Path = await ffmpeg({
          inputPath: audioStage1Path,
          durationMs: lastEnd * 1000,
          format: "opus",
        });
      } catch {
        unlink(audioStage1Path).catch();
        unlink(savedReplayPath).catch();
        throw new Error("Failed to crop audio");
      } finally {
        unlink(audioStage1Path).catch();
      }

      // generate image file
      let imagePath: string;
      try {
        imagePath = await ffmpeg({
          inputPath: savedReplayPath,
          seekMs: offsetMs + lastEnd * 1000,
          format: "webp",
        });
      } catch {
        unlink(savedReplayPath).catch();
        throw new Error("Failed to extract image");
      } finally {
        unlink(savedReplayPath).catch();
      }
    }
  }

  return new AnkiClient();
}

export const ankiClient = signal(createAnkiClient());
