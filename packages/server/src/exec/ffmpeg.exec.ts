import path from "node:path";

import type { State } from "#/state/state";
import { yyyyMMdd_HHmmss } from "#/util/date";
import { safeMkdir } from "#/util/fs";
import { R } from "@praha/byethrow";
import type { Logger } from "pino";
import { uid } from "uid";

import { Exec } from "./Exec";

type Quality = "very-low" | "low" | "medium" | "high" | "very-high";

interface SelectionData {
  x: number;
  y: number;
  width: number;
  height: number;
}

type ProcessFormat =
  | "wav"
  | "opus"
  | "mp3"
  | "webp"
  | "webp:crop"
  | "webp:multiple"
  | "jpeg"
  | "jpeg:crop"
  | "jpeg:multiple"
  | "webp:animated";

type ActualFormat = "wav" | "opus" | "mp3" | "webp" | "jpeg";

function getPictureQuality(format: ActualFormat, quality: Quality = "medium"): string {
  const jpegQualityMap: Record<Quality, string> = {
    "very-low": "25",
    low: "15",
    medium: "8",
    high: "4",
    "very-high": "2",
  };
  const percentageQualityMap: Record<Quality, string> = {
    "very-low": "35",
    low: "50",
    medium: "65",
    high: "80",
    "very-high": "95",
  };
  if (format === "jpeg") return jpegQualityMap[quality];
  return percentageQualityMap[quality];
}

function getAudioQuality(format: ActualFormat, quality: Quality = "medium"): string {
  const opusQualityMap: Record<Quality, string> = {
    "very-low": "16k",
    low: "32k",
    medium: "64k",
    high: "128k",
    "very-high": "256k",
  };
  const mp3QualityMap: Record<Quality, string> = {
    "very-low": "64k",
    low: "128k",
    medium: "192k",
    high: "256k",
    "very-high": "320k",
  };
  if (format === "opus") return opusQualityMap[quality];
  return mp3QualityMap[quality];
}

export class FFmpegExec extends Exec {
  constructor(
    public logger: Logger,
    public state: State,
  ) {
    super(logger, state, "ffmpeg", "ffmpeg");
  }

  timestamps = new Set<string>();
  createTimestamp(): string {
    let timestamp: string;
    do {
      timestamp = `${yyyyMMdd_HHmmss(new Date())}_${uid(3)}`;
    } while (this.timestamps.has(timestamp));
    this.timestamps.add(timestamp);
    return timestamp;
  }

  async getFileDuration(filePath: string): Promise<R.Result<number, Error>> {
    const params = ["-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", filePath];
    const result = await this.exec("ffprobe", params);
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

  getActualFormat(format: ProcessFormat): ActualFormat {
    if (format === "webp:crop") return "webp";
    if (format === "webp:multiple") return "webp";
    if (format === "webp:animated") return "webp";
    if (format === "jpeg:crop") return "jpeg";
    if (format === "jpeg:multiple") return "jpeg";
    return format;
  }

  getSelectionData(selectionData: SelectionData | undefined): SelectionData {
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

    return { x, y, width, height };
  }

  async process(opts: {
    inputPath: string;
    format: ProcessFormat;
    seek?: number;
    duration?: number;
    selectionData?: SelectionData;
  }): Promise<R.Result<string, Error>> {
    const inputPath = opts.inputPath;
    const format = opts.format;
    const seek = Math.floor(opts.seek ?? 0);
    const duration = opts.duration === undefined ? undefined : Math.floor(opts.duration);
    const selectionData = opts.selectionData;

    const timestamp = this.createTimestamp();
    const actualFormat = this.getActualFormat(format);

    const tempPath = this.state.path().tempDir;
    const outputPath = `${path.join(tempPath, timestamp)}.${actualFormat}`;
    const outputDir = path.join(tempPath, timestamp);
    const outputPattern = path.join(outputDir, `${timestamp}_%03d.${actualFormat}`);
    if (format.endsWith("multiple")) {
      const result = await safeMkdir(outputDir, { recursive: true });
      if (R.isFailure(result)) return R.fail(result.error);
    }

    const maxResolution = this.state.config().ffmpegMaxPictureResolution;
    const scaleFilter = `scale='if(gt(iw,ih),-1,${maxResolution}):if(gt(ih,iw),-1,${maxResolution})':force_original_aspect_ratio=decrease`;

    const requiredDuration = duration ?? 1000;
    const numberOfFrames = this.state.config().ffmpegPictureFrameCount;
    const fps = numberOfFrames / (requiredDuration / 1000);

    const audioQuality = getAudioQuality(actualFormat);
    const pictureQuality = getPictureQuality(actualFormat);

    const audioParam = (format: "wav" | "opus" | "mp3") => {
      const codecMap = {
        wav: "pcm_s16le",
        opus: "libopus",
        mp3: "libmp3lame",
      };
      const samplingRateMap = {
        wav: "44100",
        opus: "48000",
        mp3: "44100",
      };

      const seekParam = ["-ss", `${seek}ms`];
      const inputParam = ["-i", inputPath];
      const durationParam = duration !== undefined ? ["-t", `${duration}ms`] : [];
      const stereoParam = ["-ac", "2"];
      const samplingRateParam = ["-ar", samplingRateMap[format]];
      const codecParam = ["-c:a", codecMap[format]];
      const bitrateParam = format === "wav" ? [] : ["-b:a", audioQuality];

      return [
        "-y", // overwrite existing
        ...seekParam,
        ...inputParam,
        ...durationParam,
        ...stereoParam,
        ...samplingRateParam,
        ...codecParam,
        ...bitrateParam,
        "-vn", // no video
        outputPath,
      ];
    };

    const pictureParam = () => {
      const seekParam = ["-ss", `${seek}ms`];
      const inputParam = ["-i", inputPath];
      const framesParam = ["-frames:v", "1"];
      const filterParam = ["-vf", scaleFilter];
      const qualityParam = ["-q:v", pictureQuality];

      return [
        "-y", // overwrite existing
        ...seekParam,
        ...inputParam,
        ...framesParam,
        ...filterParam,
        ...qualityParam,
        "-an", // no audio
        outputPath,
      ];
    };

    const pictureCropParam = () => {
      const { x, y, width, height } = this.getSelectionData(selectionData);
      const seekParam = ["-ss", `${seek}ms`];
      const inputParam = ["-i", inputPath];
      const framesParam = ["-frames:v", "1"];
      const filterParam = ["-vf", `crop=${width}:${height}:${x}:${y}`];
      const qualityParam = ["-q:v", pictureQuality];

      return [
        "-y", // overwrite existing
        ...seekParam,
        ...inputParam,
        ...framesParam,
        ...filterParam,
        ...qualityParam,
        "-an", // no audio
        outputPath,
      ];
    };

    const pictureMultipleParam = () => {
      const seekParam = ["-ss", `${seek}ms`];
      const inputParam = ["-i", inputPath];
      const durationParam = ["-t", `${requiredDuration}ms`];
      const frameRateParam = ["-r", `${fps}`];
      const filterParam = ["-vf", scaleFilter];
      const qualityParam = ["-q:v", pictureQuality];

      return [
        "-y", // overwrite existing
        ...seekParam,
        ...inputParam,
        ...durationParam,
        ...frameRateParam,
        ...filterParam,
        ...qualityParam,
        "-an", // no audio
        outputPattern,
      ];
    };

    const params: Record<ProcessFormat, string[]> = {
      wav: audioParam("wav"),
      opus: audioParam("opus"),
      mp3: audioParam("mp3"),
      webp: pictureParam(),
      "webp:crop": pictureCropParam(),
      "webp:multiple": pictureMultipleParam(),
      jpeg: pictureParam(),
      "jpeg:crop": pictureCropParam(),
      "jpeg:multiple": pictureMultipleParam(),
      "webp:animated": [
        "-y", // overwrite existing
        "-ss",
        `${seek}ms`,
        "-i",
        inputPath,
        "-t",
        `${requiredDuration}ms`,
        "-r",
        "24",
        "-c:v",
        "libwebp_anim",
        "-vf",
        scaleFilter,
        "-q:v",
        pictureQuality,
        outputPath,
      ],
    };

    const result = await this.run(params[format]);
    if (R.isFailure(result)) return R.fail(result.error);
    return format.endsWith("multiple") ? R.succeed(outputDir) : R.succeed(outputPath);
  }
}
