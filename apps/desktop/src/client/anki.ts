import { signal } from "alien-signals";
import { delay } from "es-toolkit";
import { sort } from "fast-sort";
import { YankiConnect } from "yanki-connect";
import { log } from "#/util/logger";
import { obsClient } from "./obs";

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
      await obsClient().client?.call("SaveReplayBuffer");
      const res = await obsClient().client?.call("GetLastReplayBufferReplay");
      console.log("DEBUG[666]: res=", res);

      const noteInfo = ((await this.client?.note.notesInfo({
        notes: [noteId],
      })) ?? [])[0];

      // console.log("DEBUG[667]: noteInfo=", noteInfo);
    }
  }

  return new AnkiClient();
}

export const ankiClient = signal(createAnkiClient());
