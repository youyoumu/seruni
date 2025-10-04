import { execSync, spawn } from "node:child_process";
import path from "node:path";
import { log } from "./logger";

export function getFileDuration(filePath: string): number | null {
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

export async function extractAudio({
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

export async function extractImage(filePath: string) {
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
