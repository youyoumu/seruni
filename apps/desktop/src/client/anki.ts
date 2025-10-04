import { signal } from "alien-signals";
import { delay } from "es-toolkit";
import { sort } from "fast-sort";
import { YankiConnect } from "yanki-connect";
import {
  cropAudioToLastVadEnd,
  extractAudio,
  extractImage,
  getFileDuration,
} from "#/util/ffmpeg";
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

      const delayMs = Math.min(10000, 1000 * 2 ** this.retryCount);
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
            this.handleNewNote(lastAddedNote);
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
      const now = new Date();
      const history = sort(textractorClient().history)
        .desc(({ time }) => time)
        .find(({ time, text }) => {
          //TODO: better support non latest history
          return time <= now && true;
        });

      if (!history) {
        log.warn("Failed to find history");
        return;
      }

      log.debug(
        {
          history: { text: history?.text, time: history?.time?.toDateString() },
        },
        "history",
      );

      let savedReplayPath: string | undefined;
      try {
        savedReplayPath = await obsClient().saveReplayBuffer();
      } catch (e) {
        log.error({ error: e }, "Failed to save replay buffer");
        return;
      }

      const fileEnd = new Date();
      let durationSeconds: number;
      try {
        durationSeconds = await getFileDuration(savedReplayPath);
      } catch (e) {
        log.error({ error: e }, "Failed to get duration");
        return;
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

      let audioStage1Path: string;
      try {
        audioStage1Path = await extractAudio({
          filePath: savedReplayPath,
          offsetMs,
        });
      } catch (e) {
        log.error({ error: e }, "Failed to extract audio");
        return;
      }

      let audioStage1VadData: {
        start: number;
        end: number;
      }[];
      try {
        audioStage1VadData = JSON.parse(await python([audioStage1Path]));
      } catch (e) {
        log.error({ error: e }, "Failed to extract audio VAD data");
        return;
      }

      let audioStage2Path: string;
      try {
        audioStage2Path = await cropAudioToLastVadEnd({
          inputPath: audioStage1Path,
          vadData: audioStage1VadData,
        });
      } catch (e) {
        log.error({ error: e }, "Failed to crop audio");
        return;
      }

      log.info(audioStage2Path);

      try {
        //TODO: offset
        extractImage(savedReplayPath);
      } catch (e) {
        log.error({ error: e }, "Failed to extract image");
      }
    }
  }

  return new AnkiClient();
}

export const ankiClient = signal(createAnkiClient());
