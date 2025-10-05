import path, { join } from "node:path";
import { format } from "date-fns";
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

//TODO: offset start
export async function extractAudio({
  filePath,
  offsetMs,
}: {
  filePath: string;
  offsetMs: number;
}) {
  const outPath = path.join(
    env.TEMP_PATH,
    `${path.basename(filePath, path.extname(filePath))}.wav`,
  );

  const { stdout, stderr } = await execa("ffmpeg", [
    "-y", // overwrite existing
    "-i",
    filePath, // input file
    "-ss",
    `${offsetMs}ms`,
    "-vn", // no video
    "-acodec",
    "pcm_s16le", // WAV codec
    "-ar",
    "44100", // sample rate
    "-ac",
    "2", // stereo
    outPath,
  ]);
  log.trace({ stdout, stderr }, "ffmpeg");

  return outPath;
}

interface VadSegment {
  start: number;
  end: number;
}

//TODO: offset
export async function cropAudioToLastVadEnd({
  inputPath,
  vadData,
}: {
  inputPath: string;
  vadData: VadSegment[];
}): Promise<string> {
  if (!vadData.length) {
    throw new Error("No VAD segments found");
  }

  // Find the last VAD segment end time
  const lastEnd = vadData[vadData.length - 1]?.end;
  if (!lastEnd) {
    throw new Error("No last VAD segment end time found");
  }

  const outputPath = join(
    env.TEMP_PATH,
    `${format(new Date(), "yyyyMMdd_HHmmss_SSS")}.opus`,
  );

  const { stdout, stderr } = await execa("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-t",
    lastEnd.toString(),
    "-ac",
    "2", // 1 = mono, 2 = stereo
    "-ar",
    "48000", // Opus requires 48kHz input
    "-c:a",
    "libopus", // use the Opus codec
    "-b:a",
    "32k", // bitrate (32 kbps is great for speech)
    outputPath,
  ]);
  log.trace({ stdout, stderr }, "ffmpeg");

  return outputPath;
}

export async function extractImage(filePath: string) {
  const outPath = path.join(
    env.TEMP_PATH,
    `${format(new Date(), "yyyyMMdd_HHmmss_SSS")}.webp`,
  );

  const { stdout, stderr } = await execa("ffmpeg", [
    "-y", // overwrite existing
    "-i",
    filePath, // input file
    "-frames:v",
    "1", // only 1 frame
    "-q:v",
    "60", // quality (1-100, worst to best)
    outPath,
  ]);
  log.trace({ stdout, stderr }, "ffmpeg extractImage");

  return outPath;
}
