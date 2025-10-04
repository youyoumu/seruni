import { randomUUID } from "node:crypto";
import path, { join } from "node:path";
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
    path.dirname(filePath),
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
  const outputPath = join(env.TEMP_PATH, `${randomUUID()}.wav`);

  // FFmpeg command:
  // -y: overwrite
  // -i: input file
  // -t: duration (seconds)
  // -acodec copy: copy audio codec (no re-encoding)
  const { stdout, stderr } = await execa("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-t",
    lastEnd.toString(),
    "-acodec",
    "copy",
    outputPath,
  ]);
  log.trace({ stdout, stderr }, "ffmpeg");

  return outputPath;
}

export async function extractImage(filePath: string) {
  const outPath = path.join(
    path.dirname(filePath),
    `${path.basename(filePath, path.extname(filePath))}.jpeg`,
  );

  const { stdout, stderr } = await execa("ffmpeg", [
    "-y", // overwrite existing
    "-i",
    filePath, // input file
    "-frames:v",
    "1",
    "-q:v", // quality
    "2",
    outPath,
  ]);
  log.trace({ stdout, stderr }, "ffmpeg");

  return outPath;
}
