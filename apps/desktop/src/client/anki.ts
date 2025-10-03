import { execSync, spawn } from "node:child_process";
import path from "node:path";
import { signal } from "alien-signals";
import { delay } from "es-toolkit";
import { sort } from "fast-sort";
import { YankiConnect } from "yanki-connect";
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
      const duration = this.getFileDuration(savedReplayPath); // e.g. 19.98s
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
          this.extractAudio({ filePath: savedReplayPath, offsetSeconds });
        } catch (e) {
          log.error({ error: e }, "Failed to create WAV file");
        }
        try {
          this.extractImage(savedReplayPath);
        } catch (e) {
          log.error({ error: e }, "Failed to create JPEG file");
        }
      } else {
        log.warn("No saved replay path");
      }
    }

    getFileDuration(filePath: string): number | null {
      try {
        const output = execSync(
          `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
        )
          .toString()
          .trim();
        return parseFloat(output);
      } catch (e) {
        log.error({ error: e }, "Failed to read duration");
        return null;
      }
    }

    async extractAudio({
      filePath,
      offsetSeconds,
    }: {
      filePath: string;
      offsetSeconds: number;
    }) {
      const outPath = path.join(
        path.dirname(filePath),
        `${path.basename(filePath, path.extname(filePath))}.wav`,
      );

      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", [
          "-y", // overwrite existing
          "-i",
          filePath, // input file
          "-ss",
          String(offsetSeconds),
          "-vn", // no video
          "-acodec",
          "pcm_s16le", // WAV codec
          "-ar",
          "44100", // sample rate
          "-ac",
          "2", // stereo
          outPath,
        ]);

        ffmpeg.stdout.on("data", (d) =>
          log.trace({ stdout: d.toString() }, "ffmpeg"),
        );
        ffmpeg.stderr.on("data", (d) =>
          log.trace({ stderr: d.toString() }, "ffmpeg"),
        );

        ffmpeg.on("close", (code) => {
          if (code === 0) {
            log.debug(`WAV file created at: ${outPath}`);
            resolve();
          } else {
            reject(new Error(`ffmpeg exited with code ${code}`));
          }
        });
      });
    }

    async extractImage(filePath: string) {
      const outPath = path.join(
        path.dirname(filePath),
        `${path.basename(filePath, path.extname(filePath))}.jpeg`,
      );

      // Extract first frame as JPEG
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", [
          "-y", // overwrite existing
          "-i",
          filePath, // input file
          "-frames:v",
          "1",
          "-q:v", // quality
          "2",
          outPath,
        ]);

        ffmpeg.stdout.on("data", (d) =>
          log.trace({ stdout: d.toString() }, "ffmpeg"),
        );
        ffmpeg.stderr.on("data", (d) =>
          log.trace({ stderr: d.toString() }, "ffmpeg"),
        );

        ffmpeg.on("close", (code) => {
          if (code === 0) {
            log.debug(`JPEG file created at: ${outPath}`);
            resolve();
          } else {
            reject(new Error(`ffmpeg exited with code ${code}`));
          }
        });
      });
    }
  }

  return new AnkiClient();
}

export const ankiClient = signal(createAnkiClient());
