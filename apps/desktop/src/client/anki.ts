import { signal } from "alien-signals";
import { delay } from "es-toolkit";
import { sort } from "fast-sort";
import { YankiConnect } from "yanki-connect";
import { extractAudio, extractImage, getFileDuration } from "#/util/ffmpeg";
import { log } from "#/util/logger";
import { obsClient } from "./obs";
import { textractorClient } from "./textractor";

export function createAnkiClient() {
  class AnkiClient {
    client: YankiConnect | undefined;
    lastAddedNote: number | undefined;
    constructor() {}

    async prepare() {
      try {
        this.client = new YankiConnect();
        this.lastAddedNote = await this.getLastAddedNote();
      } catch (e) {
        log.error({ error: e }, "Failed to connect to Anki connect");
      }
    }

    async getLastAddedNote() {
      const res = await this.client?.note.findNotes({
        query: "added:1",
      });
      return sort(res ?? []).desc()[0];
    }

    async monitor() {
      if (!this.client) return;
      while (true) {
        const lastAddedNote = await this.getLastAddedNote();
        if (
          lastAddedNote &&
          (!this.lastAddedNote || lastAddedNote > this.lastAddedNote)
        ) {
          this.lastAddedNote = lastAddedNote;
          this.handleNewNote(lastAddedNote);
        }
        delay(1000);
      }
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
      const duration = getFileDuration(savedReplayPath); // e.g. 19.98s
      if (!duration) {
        log.warn("Failed to get duration");
        return;
      }
      const fileStart = new Date(fileEnd.getTime() - duration * 1000);
      const offsetSeconds = Math.max(
        0,
        Math.floor((history.time.getTime() - fileStart.getTime()) / 1000),
      );

      const noteInfo = ((await this.client?.note.notesInfo({
        notes: [noteId],
      })) ?? [])[0];

      log.debug({ noteInfo }, "noteInfo");

      try {
        extractAudio({ filePath: savedReplayPath, offsetSeconds });
      } catch (e) {
        log.error({ error: e }, "Failed to extract audio");
      }
      try {
        extractImage(savedReplayPath);
      } catch (e) {
        log.error({ error: e }, "Failed to extract image");
      }
    }
  }

  return new AnkiClient();
}

export const ankiClient = signal(createAnkiClient());
