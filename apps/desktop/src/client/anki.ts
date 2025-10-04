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

      const savedReplayPath = await obsClient().saveReplayBuffer();
      if (!savedReplayPath) return;
      // 1. File end = now (after save finishes)
      const fileEnd = new Date();

      // 2. Duration from metadata
      const duration = getFileDuration(savedReplayPath); // e.g. 19.98s
      if (!duration) return;

      // 3. File start = end - duration
      const fileStart = new Date(fileEnd.getTime() - duration * 1000);

      // 4. Compute offset for note
      const offsetSeconds = Math.max(
        0,
        Math.floor((history.time.getTime() - fileStart.getTime()) / 1000),
      );

      const noteInfo = ((await this.client?.note.notesInfo({
        notes: [noteId],
      })) ?? [])[0];

      log.debug({ noteInfo }, "noteInfo");

      if (savedReplayPath) {
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
      } else {
        log.warn("No saved replay path");
      }
    }
  }

  return new AnkiClient();
}

export const ankiClient = signal(createAnkiClient());
