import { join } from "node:path";
import { effect, effectScope } from "alien-signals";
import { AnkiClient, ankiClient } from "#/client/clientAnki";
import { obsClient } from "#/client/clientObs";
import { textractorClient } from "#/client/clientTextractor";
import { mainDB } from "#/db/dbMain";
import { env } from "#/env";
import {
  interceptedRequest,
  proxyAnkiConnectNewNoteRequest,
} from "#/hono/_util";
import { ffmpeg } from "#/runner/runnerFfmpeg";
import { bus } from "#/util/bus";
import { config } from "#/util/config";
import { log } from "#/util/logger";
import { IPC } from "./ipcBase";

class MiningIPC extends IPC()<"mining"> {
  stopScopes = new Set<() => void>();
  constructor() {
    super({ prefix: "mining" });
  }

  override register() {
    this.handle("mining:setTextUuid", async (_, { uuid }) => {
      ankiClient().selectedTextUuid = uuid;
      return { uuid };
    });

    this.handle("mining:getTextHistory", async () => {
      return textractorClient().history;
    });

    this.handle("mining:getReplayBufferStartTime", async () => {
      return {
        time: obsClient().replayBufferStartTime(),
      };
    });

    this.handle("mining:getReplayBufferDuration", async () => {
      return {
        duration: obsClient().replayBufferDuration(),
      };
    });

    this.stopScopes.add(
      effectScope(() => {
        effect(() => {
          this.send("mining:sendReplayBufferStartTime", {
            time: obsClient().replayBufferStartTime(),
          });
        });
      }),
    );

    this.stopScopes.add(
      effectScope(() => {
        effect(() => {
          this.send("mining:sendReplayBufferDuration", {
            duration: obsClient().replayBufferDuration(),
          });
        });
      }),
    );

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
      if (!ankiClient().client) throw new Error("Anki client not connected");
      const noteIds = await ankiClient().client?.note.findNotes({
        query: `tag:${env.APP_NAME}`,
      });

      if (!noteIds) return [];

      const notes = await ankiClient().client?.note.notesInfo({
        notes: noteIds,
      });
      if (!notes) return [];

      const data = notes.map((note) => {
        const expression = AnkiClient().getExpression(note);

        const pictureFieldValue =
          note.fields[config.store.anki.pictureField]?.value ?? "";
        const sentenceAudioFieldValue =
          note.fields[config.store.anki.sentenceAudioField]?.value ?? "";

        const pictureMedia = AnkiClient().parseAnkiMediaPath(pictureFieldValue);
        const audioMedia = AnkiClient().parseAnkiMediaPath(
          sentenceAudioFieldValue,
        );

        const mediaDir = ankiClient().mediaDir;
        const picturePath =
          pictureMedia && mediaDir ? join(mediaDir, pictureMedia) : undefined;
        const sentenceAudioPath =
          audioMedia && mediaDir ? join(mediaDir, audioMedia) : undefined;

        return {
          id: note.noteId,
          expression,
          picture: pictureMedia,
          picturePath,
          sentenceAudio: audioMedia,
          sentenceAudioPath,
          nsfw: AnkiClient().inNsfw(note),
        };
      });

      return data;
    });

    this.handle("mining:getNoteMedia", async (_, { noteId }) => {
      return await mainDB().getNoteMedia(noteId);
    });

    this.handle("mining:deleteNoteMedia", async (_, { fileName }) => {
      const notes = await mainDB().deleteNoteMedia(fileName);
      return { noteIds: notes.map((n) => n.noteId) };
    });

    this.handle(
      "mining:cropPicture",
      async (_, noteId, { source, fileName }, selectionData) => {
        const inputPath = () => {
          if (source === "anki") {
            const ankiMediaDir = ankiClient().mediaDir;
            if (!ankiMediaDir)
              throw new Error(
                "Anki media dir not found, is AnkiConnect running?",
              );
            return join(ankiMediaDir, fileName);
          } else {
            return join(env.STORAGE_PATH, fileName);
          }
        };
        log.debug(
          { inputPath: inputPath(), selectionData },
          "Cropping picture",
        );
        const filePath = await ffmpeg().process({
          inputPath: inputPath(),
          selectionData,
          format: "webp:crop",
        });
        await mainDB().insertNoteAndMedia({
          noteId,
          media: [{ filePath, type: "picture" }],
        });
      },
    );

    this.handle(
      "mining:trimAudio",
      async (_, noteId, { fileName, source }, trimData) => {
        const inputPath = () => {
          if (source === "anki") {
            const ankiMediaDir = ankiClient().mediaDir;
            if (!ankiMediaDir)
              throw new Error(
                "Anki media dir not found, is AnkiConnect running?",
              );
            return join(ankiMediaDir, fileName);
          } else {
            return join(env.STORAGE_PATH, fileName);
          }
        };
        log.debug({ inputPath: inputPath(), trimData }, "Trimming audio");
        const filePath = await ffmpeg().process({
          inputPath: inputPath(),
          format: "opus",
          seek: trimData.start,
          duration: trimData.end - trimData.start,
        });
        await mainDB().insertNoteAndMedia({
          noteId,
          media: [{ filePath, type: "sentenceAudio" }],
        });
      },
    );

    this.handle(
      "mining:updateNote",
      async (_, { noteId, picture, sentenceAudio, nsfw }) => {
        log.debug(
          { payload: { noteId, picture, sentenceAudio, nsfw } },
          "mining:updateNote",
        );
        const note = await ankiClient().getNote(noteId);
        await ankiClient().updateNote({
          note,
          picturePath: picture ? join(env.STORAGE_PATH, picture) : undefined,
          sentenceAudioPath: sentenceAudio
            ? join(env.STORAGE_PATH, sentenceAudio)
            : undefined,
          nsfw,
          overwrite: true,
        });
      },
    );

    this.handle("mining:confirmDuplicateNote", async (_, payload) => {
      const request = interceptedRequest.get(payload.uuid);
      if (!request) throw new Error("No request found");
      if (payload.action === "create") {
        await proxyAnkiConnectNewNoteRequest(request);
      } else if (payload.action === "update") {
        const noteId = payload.params?.noteId;
        if (!noteId) throw new Error("Note ID is missing");
        bus.emit("anki:handleUpdateNoteMedia", { noteId });
      }
    });
  }

  override unregister(): void {
    super.unregister();
    this.stopScopes.forEach((stopScope) => {
      stopScope();
    });
  }
}

export const miningIPC = hmr.module(new MiningIPC());

//  ───────────────────────────────── HMR ─────────────────────────────────

if (import.meta.hot) {
  const { miningIPC } = await hmr.register<typeof import("./ipcMining")>(
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
