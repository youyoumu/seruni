import { join } from "node:path";
import { signal } from "alien-signals";
import { ankiClient, obsClient } from "#/client";
import { env } from "#/env";
import { config } from "#/util/config";
import { hmr } from "#/util/hmr";
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
        try {
          const mediaPath = await ankiClient().client?.media.getMediaDirPath();

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

            const pictureMedia = this.parseAnkiMediaPaths(
              pictureFieldValue,
              mediaPath,
            );
            const audioMedia = this.parseAnkiMediaPaths(
              sentenceAudioFieldValue,
              mediaPath,
            );

            return {
              id: note.noteId,
              word,
              picturePath: pictureMedia.image,
              sentenceAudioPath: audioMedia.sound,
            };
          });

          return { data: data ?? [] };
        } catch {
          return { data: [] };
        }
      });
    }

    parseAnkiMediaPaths(fieldValue: string, mediaPath: string | undefined) {
      if (!mediaPath) return { image: "", sound: "" };
      const imageRegex = /<img\s+[^>]*src=["']([^"']+)["']/gi;
      const soundRegex = /\[sound:([^\]]+)\]/gi;
      const images = [...fieldValue.matchAll(imageRegex)].map((m) =>
        join(mediaPath, m[1] ?? ""),
      );
      const sounds = [...fieldValue.matchAll(soundRegex)].map((m) =>
        join(mediaPath, m[1] ?? ""),
      );
      return { image: images[0] ?? "", sound: sounds[0] ?? "" };
    }
  }

  return new MiningIPC();
}

export const miningIPC = signal(createMiningIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  hmr.register(import.meta.url);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta.url, mod);
    mod?.miningIPC().register();
  });
  import.meta.hot.dispose(() => {
    miningIPC().unregister();
  });
}
