import { AnkiClient, ankiClient } from "#/client/anki";
import { obsClient } from "#/client/obs";
import { textractorClient } from "#/client/textractor";
import { mainDB } from "#/db/main";
import { env } from "#/env";
import { config } from "#/util/config";
import { log } from "#/util/logger";
import { IPC } from "./base";

class MiningIPC extends IPC()<"mining"> {
  constructor() {
    super({
      prefix: "mining",
    });
  }

  override register() {
    this.handle("mining:setTextUuid", async (_, { uuid }) => {
      ankiClient().selectedTextUuid = uuid;
      return { uuid };
    });

    this.handle("mining:getTextHistory", async () => {
      return textractorClient().history;
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
        const noteIds = await ankiClient().client?.note.findNotes({
          query: `tag:${env.APP_NAME}`,
        });

        if (!noteIds)
          return {
            success: false,
            data: [],
          };

        const notes = await ankiClient().client?.note.notesInfo({
          notes: noteIds,
        });

        if (!notes)
          return {
            success: false,
            data: [],
          };

        const data = notes.map((note) => {
          const expression = AnkiClient().getExpression(note);

          const pictureFieldValue =
            note.fields[config.store.anki.pictureField]?.value ?? "";
          const sentenceAudioFieldValue =
            note.fields[config.store.anki.sentenceAudioField]?.value ?? "";

          const pictureMedia = this.parseAnkiMediaPath(pictureFieldValue);
          const audioMedia = this.parseAnkiMediaPath(sentenceAudioFieldValue);

          return {
            id: note.noteId,
            expression,
            picture: pictureMedia,
            sentenceAudio: audioMedia,
            nsfw: AnkiClient().inNsfw(note),
          };
        });

        return {
          success: true,
          data,
        };
      } catch {
        return {
          success: false,
          data: [],
        };
      }
    });

    this.handle("mining:toggleNoteNsfw", async (_, { noteId, checked }) => {
      log.debug({ noteId, checked }, `Updating note NSFW tag`);
      try {
        const note = await ankiClient().getNote(noteId);
        const nsfw = AnkiClient().inNsfw(note);
        if (nsfw === checked) {
          log.warn("Note already has the same NSFW tag");
          return true;
        }
        const client = ankiClient().client;
        if (!client) {
          log.error("Anki client not connected");
          return false;
        }
        if (checked) {
          await client.note.addTags({
            notes: [noteId],
            tags: "NSFW",
          });
        } else {
          await client.note.removeTags({
            notes: [noteId],
            tags: "NSFW",
          });
        }
        log.debug({ noteId, checked }, "Note NSFW tag updated");
        return true;
      } catch (e) {
        log.error({ error: e }, "Failed to update note NSFW tag");
        return false;
      }
    });

    this.handle("mining:getNoteMedia", async (_, { noteId }) => {
      return await mainDB().getNoteMedia(noteId);
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

export const miningIPC = hmr.module(new MiningIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  const { miningIPC } = await hmr.register<typeof import("./mining")>(
    import.meta,
  );

  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
    miningIPC().register();
  });

  import.meta.hot.dispose(() => {
    miningIPC().unregister();
  });
}
