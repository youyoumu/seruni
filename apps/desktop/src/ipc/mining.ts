import { signal } from "alien-signals";
import { ankiClient, obsClient } from "#/client";
import { env } from "#/env";
import { config } from "#/util/config";
import { mainWindow } from "#/window/main";
import { IPC } from "./base";

function createMiningIPC() {
  class MiningIPC extends IPC()<"mining"> {
    textUuid = "";
    constructor() {
      super({
        prefix: "mining",
        win: () => [mainWindow().win],
      });
    }

    override register() {
      this.handle("mining:setTextUuid", async (_, { uuid }) => {
        this.textUuid = uuid;
        return { uuid: this.textUuid };
      });

      this.handle("mining:getSourceScreenshot", async () => {
        const currentProgramScene = await obsClient()
          .client?.call("GetCurrentProgramScene")
          .catch(() => {});
        const sourceScreenshot = await obsClient()
          .client?.call("GetSourceScreenshot", {
            imageFormat: "jpeg",
            sourceUuid: currentProgramScene?.sceneUuid,
          })
          .catch(() => {});

        return { image: sourceScreenshot?.imageData ?? null };
      });

      this.handle("mining:getAnkiHistory", async () => {
        console.log("DEBUG[712]: ankiClient().client=", ankiClient().client);
        try {
          const noteIds = await ankiClient().client?.note.findNotes({
            query: `tag:${env.APP_NAME}`,
          });

          if (!noteIds) return { data: [] };

          const notes = await ankiClient().client?.note.notesInfo({
            notes: noteIds,
          });

          if (!notes) return { data: [] };

          const data = notes.map((note) => {
            const firstField = Object.keys(note.fields)[0] ?? "";
            const word = note.fields[firstField]?.value ?? "";

            const pictureFieldValue =
              note.fields[config.store.anki.pictureField]?.value ?? "";
            const sentenceAudioFieldValue =
              note.fields[config.store.anki.sentenceAudioField]?.value ?? "";

            const pictureMedia = this.parseAnkiMediaPath(pictureFieldValue);
            const audioMedia = this.parseAnkiMediaPath(sentenceAudioFieldValue);

            return {
              id: note.noteId,
              word,
              picturePath: pictureMedia,
              sentenceAudioPath: audioMedia,
            };
          });

          return { data: data ?? [] };
        } catch {
          return { data: [] };
        }
      });

      this.handle("mining:getAnkiMediaUrl", async () => {
        return { url: env.ANKI_MEDIA_URL };
      });
    }

    parseAnkiMediaPath(fieldValue: string) {
      const imageRegex = /<img\s+[^>]*src=["']([^"']+)["']/i;
      const soundRegex = /\[sound:([^\]]+)\]/i;

      const imageMatch = fieldValue.match(imageRegex);
      const soundMatch = fieldValue.match(soundRegex);

      return imageMatch?.[1] ?? soundMatch?.[1] ?? "";
    }
  }

  return new MiningIPC();
}

export const miningIPC = signal(createMiningIPC());
global.miningIPC ??= miningIPC;

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  type Self = typeof import("./mining");
  const url = import.meta.url;
  hmr.register(url);

  import.meta.hot.accept((mod) => {
    hmr.update(url, mod);
    const { miningIPC } = hmr.m<Self>(url);
    miningIPC().register();
  });

  import.meta.hot.dispose(() => {
    const { miningIPC } = hmr.m<Self>(url);
    miningIPC().unregister();
  });
}
