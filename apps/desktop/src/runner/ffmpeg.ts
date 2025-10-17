import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { format as formatDate } from "date-fns";
import { execa } from "execa";
import { env } from "#/env";
import { log } from "#/util/logger";

hmr.log(import.meta);

class FFmpeg {
  usedTimestamps: string[] = [];

  getTimestamp(): string {
    const timestamp = `${formatDate(new Date(), "yyyyMMdd_HHmmss")}_${crypto.randomUUID().slice(0, 3)}`;
    if (this.usedTimestamps.includes(timestamp)) {
      return this.getTimestamp();
    }
    this.usedTimestamps.push(timestamp);
    return timestamp;
  }

  async getFileDuration(filePath: string): Promise<number> {
    const { stdout, stderr } = await execa("ffprobe", [
      "-v",
      "quiet",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      filePath,
    ]);
    log.debug({ stdout, stderr }, "ffprobe");
    return parseFloat(stdout.trim());
  }

  //TODO: offset +-
  async process({
    inputPath,
    seekMs = 0,
    durationMs,
    format,
  }: {
    inputPath: string;
    seekMs?: number;
    durationMs?: number;
    format:
      | "wav"
      | "opus"
      | "webp"
      | "webp:multiple"
      | "webp:animated"
      | "png:multiple";
  }) {
    const timestamp = this.getTimestamp();
    const actualFormat = () => {
      if (format === "png:multiple") return "png";
      if (format === "webp:multiple") return "webp";
      if (format === "webp:animated") return "webp";
      return format;
    };

    const outputPath = join(env.TEMP_PATH, `${timestamp}.${actualFormat()}`);
    const outputDir = join(env.TEMP_PATH, `${timestamp}`);
    if (format.endsWith("multiple")) {
      await mkdir(outputDir, { recursive: true });
    }
    const outputPattern = join(
      outputDir,
      `${timestamp}_%03d.${actualFormat()}`,
    );

    //TODO: configurable
    const defaultDurationMs = 1000;
    const numberOfFrames = 6;
    const fps = numberOfFrames / ((durationMs ?? defaultDurationMs) / 1000);

    const params = {
      wav: [
        "-y", // overwrite existing
        "-ss",
        `${seekMs}ms`,
        "-i",
        inputPath, // input file
        ...(durationMs !== undefined ? ["-t", `${durationMs}ms`] : []),
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
        "-ss",
        `${seekMs}ms`,
        "-i",
        inputPath,
        ...(durationMs !== undefined ? ["-t", `${durationMs}ms`] : []),
        "-vn",
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
        "-ss",
        `${seekMs}ms`,
        "-i",
        inputPath,
        "-frames:v",
        "1", // only 1 frame
        "-vf",
        "scale='if(gt(iw,ih),-1,720)':'if(gt(ih,iw),-1,720)':force_original_aspect_ratio=decrease", // max 720p
        "-q:v",
        "75", // quality (1-100, worst to best)
        outputPath,
      ],

      "webp:multiple": [
        "-y",
        "-ss",
        `${seekMs}ms`,
        "-i",
        inputPath,
        "-t",
        `${durationMs ?? defaultDurationMs}ms`,
        "-r",
        `${fps}`,
        "-c:v",
        "libwebp",
        "-vf",
        `scale='if(gt(iw,ih),-1,720)':'if(gt(ih,iw),-1,720)':force_original_aspect_ratio=decrease`,
        "-q:v",
        "75", // quality (1-100, worst to best)
        outputPattern,
      ],

      "png:multiple": [
        "-y",
        "-ss",
        `${seekMs}ms`,
        "-i",
        inputPath,
        "-t",
        `${durationMs ?? defaultDurationMs}ms`,
        "-r",
        `${fps}`,
        "-vf",
        `scale='if(gt(iw,ih),-1,720)':'if(gt(ih,iw),-1,720)':force_original_aspect_ratio=decrease`,
        "-q:v",
        "75", // quality (1-100, worst to best)
        outputPattern,
      ],

      "webp:animated": [
        "-y",
        "-ss",
        `${seekMs}ms`,
        "-i",
        inputPath,
        "-t",
        `${durationMs ?? defaultDurationMs}ms`,
        "-r",
        "24",
        "-c:v",
        "libwebp_anim",
        "-vf",
        `scale='if(gt(iw,ih),-1,720)':'if(gt(ih,iw),-1,720)':force_original_aspect_ratio=decrease`,
        "-q:v",
        "75", // quality (1-100, worst to best)
        outputPath,
      ],
    };

    const { stdout, stderr } = await execa("ffmpeg", params[format]);
    log.debug(
      {
        params: params[format],
        stdout,
        stderr,
      },
      "ffmpeg",
    );

    return format.endsWith("multiple") ? outputDir : outputPath;
  }
}

export const ffmpeg = hmr.module(new FFmpeg());

//  ───────────────────────────────── HMR ─────────────────────────────────

type Self = typeof import("./ffmpeg");
const module: Self = { ffmpeg };
if (import.meta.hot) {
  hmr.register<Self>(import.meta, module);
  import.meta.hot.accept((mod) => {
    hmr.update(import.meta, mod);
  });
}
