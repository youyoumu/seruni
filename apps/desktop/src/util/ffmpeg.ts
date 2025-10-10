import { join } from "node:path";
import { format as formatDate } from "date-fns";
import { execa } from "execa";
import { env } from "#/env";
import { log } from "./logger";

export async function getFileDuration(filePath: string): Promise<number> {
  const { stdout, stderr } = await execa("ffprobe", [
    "-v",
    "quiet",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    filePath,
  ]);
  log.trace({ stdout, stderr }, "ffprobe");
  return parseFloat(stdout.trim());
}

//TODO: offset +-
export async function ffmpeg({
  inputPath,
  seekMs = 0,
  durationMs = 0,
  format,
}: {
  inputPath: string;
  seekMs?: number;
  durationMs?: number;
  format: "wav" | "opus" | "webp";
}) {
  const outputPath = join(
    env.TEMP_PATH,
    `${formatDate(new Date(), "yyyyMMdd_HHmmss_SSS")}.${format}`,
  );

  const params = {
    wav: [
      "-y", // overwrite existing
      "-i",
      inputPath, // input file
      "-ss",
      `${seekMs}ms`,
      "-vn", // no video
      "-acodec",
      "pcm_s16le", // WAV codec
      "-ar",
      "44100", // sample rate
      "-ac",
      "2", // stereo
      outputPath,
    ],

    opus: [
      "-y",
      "-i",
      inputPath,
      "-t",
      `${durationMs}ms`,
      "-ac",
      "2", // 1 = mono, 2 = stereo
      "-ar",
      "48000", // Opus requires 48kHz input
      "-c:a",
      "libopus", // use the Opus codec
      "-b:a",
      "64k", // bitrate (32 kbps is great for speech)
      outputPath,
    ],

    webp: [
      "-y",
      "-i",
      inputPath,
      "-ss",
      `${seekMs}ms`,
      "-frames:v",
      "1", // only 1 frame
      "-vf",
      "scale='if(gt(iw,ih),-1,720)':'if(gt(ih,iw),-1,720)':force_original_aspect_ratio=decrease", // max 720p
      "-q:v",
      "75", // quality (1-100, worst to best)
      outputPath,
    ],
  };

  const { stdout, stderr } = await execa("ffmpeg", params[format]);
  log.trace(
    {
      params: params[format],
      stdout,
      stderr,
    },
    "ffmpeg",
  );

  return outputPath;
}
