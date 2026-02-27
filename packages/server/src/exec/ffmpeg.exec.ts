import type { State } from "#/state/state";
import { safeMkdir } from "#/util/fs";
import { R } from "@praha/byethrow";
import { format as formatDate } from "date-fns";
import type { Logger } from "pino";
import { uid } from "uid";

import { Exec } from "./Exec";

interface SelectionData {
  x: number;
  y: number;
  width: number;
  height: number;
}

type ProcessFormat =
  | "wav"
  | "opus"
  | "webp"
  | "webp:crop"
  | "webp:multiple"
  | "webp:animated"
  | "png:multiple";

export class FFmpegExec extends Exec {
  constructor(
    public logger: Logger,
    public state: State,
  ) {
    super(logger, state, "ffmpeg", "ffmpeg");
  }

  timestamps = new Set<string>();
  createTimestamp(): string {
    const timestamp = `${formatDate(new Date(), "yyyyMMdd_HHmmss")}_${uid(3)}`;
    if (this.timestamps.has(timestamp)) {
      return this.createTimestamp();
    }
    this.timestamps.add(timestamp);
    return timestamp;
  }

  async getFileDuration(filePath: string): Promise<R.Result<number, Error>> {
    const params = ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", filePath];
    const result = await this.safeExeca("ffprobe", params);
    if (R.isFailure(result)) return R.fail(result.error);
    const { stdout, stderr } = result.value;
    this.log.trace({ params, stdout, stderr }, "ffprobe");
    return R.succeed(parseFloat(stdout.trim()) * 1000);
  }

  async version(): Promise<R.Result<string, Error>> {
    const result = await this.run(["-version"]);
    if (R.isFailure(result)) return R.fail(result.error);
    return R.succeed(result.value.stdout.split("\n")[0] ?? "");
  }

  async process({
    inputPath,
    seek = 0,
    duration,
    format,
    selectionData,
  }: {
    inputPath: string;
    seek?: number;
    duration?: number;
    selectionData?: SelectionData;
    format: ProcessFormat;
  }): Promise<R.Result<string, Error>> {
    const timestamp = this.createTimestamp();
    const actualFormat = (() => {
      if (format === "png:multiple") return "png";
      if (format === "webp:crop") return "webp";
      if (format === "webp:multiple") return "webp";
      if (format === "webp:animated") return "webp";
      return format;
    })();

    const tempPath = this.state.path().tempDir;
    const outputPath = `${tempPath}/${timestamp}.${actualFormat}`;
    const outputDir = `${tempPath}/${timestamp}`;
    if (format.endsWith("multiple")) {
      await safeMkdir(outputDir, { recursive: true });
    }
    const outputPattern = `${outputDir}/${timestamp}_%03d.${actualFormat}`;

    const maxResolution = this.state.config().ffmpegMaxPictureResolution;
    const scaleFilter = `scale='if(gt(iw,ih),-1,${maxResolution}):if(gt(ih,iw),-1,${maxResolution})':force_original_aspect_ratio=decrease`;

    const defaultDuration = 1000;
    const numberOfFrames = this.state.config().ffmpegPictureFrameCount;
    const fps = numberOfFrames / ((duration ?? defaultDuration) / 1000);
    let { x, y, width, height } = selectionData ?? {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
    x = Math.floor(x);
    y = Math.floor(y);
    width = Math.floor(width);
    height = Math.floor(height);
    seek = Math.floor(seek);
    duration = duration === undefined ? undefined : Math.floor(duration);

    const params: Record<ProcessFormat, string[]> = {
      wav: [
        "-y", // overwrite existing
        "-ss",
        `${seek}ms`,
        "-i",
        inputPath, // input file
        ...(duration !== undefined ? ["-t", `${duration}ms`] : []),
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
        "-y", // overwrite existing
        "-ss",
        `${seek}ms`,
        "-i",
        inputPath, // input file
        ...(duration !== undefined ? ["-t", `${duration}ms`] : []),
        "-vn", // no video
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
        "-y", // overwrite existing
        "-ss",
        `${seek}ms`,
        "-i",
        inputPath, // input file
        "-frames:v",
        "1", // only 1 frame
        "-vf",
        scaleFilter, // max resolution
        "-q:v",
        "75", // quality (1-100, worst to best)
        outputPath,
      ],

      "webp:crop": [
        "-y", // overwrite existing
        "-ss",
        `${seek}ms`,
        "-i",
        inputPath, // input file
        "-frames:v",
        "1", // only 1 frame
        "-vf",
        `crop=${width}:${height}:${x}:${y}`, // crop to selection
        "-q:v",
        "75", // quality (1-100, worst to best)
        outputPath,
      ],

      "webp:multiple": [
        "-y", // overwrite existing
        "-ss",
        `${seek}ms`,
        "-i",
        inputPath, // input file
        "-t",
        `${duration ?? defaultDuration}ms`, // duration
        "-r",
        `${fps}`, // frame rate
        "-c:v",
        "libwebp", // WebP codec
        "-vf",
        scaleFilter, // max resolution
        "-q:v",
        "75", // quality (1-100, worst to best)
        outputPattern,
      ],

      "png:multiple": [
        "-y", // overwrite existing
        "-ss",
        `${seek}ms`,
        "-i",
        inputPath, // input file
        "-t",
        `${duration ?? defaultDuration}ms`, // duration
        "-r",
        `${fps}`, // frame rate
        "-vf",
        scaleFilter, // max resolution
        "-q:v",
        "75", // quality (1-100, worst to best)
        outputPattern,
      ],

      "webp:animated": [
        "-y", // overwrite existing
        "-ss",
        `${seek}ms`,
        "-i",
        inputPath, // input file
        "-t",
        `${duration ?? defaultDuration}ms`, // duration
        "-r",
        "24", // frame rate
        "-c:v",
        "libwebp_anim", // animated WebP codec
        "-vf",
        scaleFilter, // max resolution
        "-q:v",
        "75", // quality (1-100, worst to best)
        outputPath,
      ],
    };

    const result = await this.run(params[format]);
    if (R.isFailure(result)) return R.fail(result.error);
    return format.endsWith("multiple") ? R.succeed(outputDir) : R.succeed(outputPath);
  }
}
