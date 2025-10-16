import { join } from "node:path";
import { format as formatDate } from "date-fns";
import { execa } from "execa";
import { env } from "#/env";
import { log } from "#/util/logger";

hmr.log(import.meta);

class FFmpeg {
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
    log.trace({ stdout, stderr }, "ffprobe");
    return parseFloat(stdout.trim());
  }

  //TODO: offset +-
  async process({
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
        "-ss",
        `${seekMs}ms`,
        "-i",
        inputPath, // input file
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
