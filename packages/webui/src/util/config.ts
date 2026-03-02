import type { Config } from "@repo/shared/schema";
import { zConfig } from "@repo/shared/schema";

export const ffmpegPictureFormatMap: Record<Config["ffmpegPictureFormat"], string> = {
  webp: "WebP",
  jpeg: "JPEG",
};
for (const key of Object.keys(ffmpegPictureFormatMap)) {
  zConfig.shape.ffmpegPictureFormat.parse(key);
}

export const ffmpegPictureQualityMap: Record<Config["ffmpegPictureQuality"], string> = {
  "very-low": "Very Low",
  low: "Low",
  medium: "Medium",
  high: "High",
  "very-high": "Very High",
};
for (const key of Object.keys(ffmpegPictureQualityMap)) {
  zConfig.shape.ffmpegPictureQuality.parse(key);
}

export const ffmpegMaxPictureResolutionMap: Record<Config["ffmpegMaxPictureResolution"], string> = {
  720: "720",
  1080: "1080",
};
for (const key of Object.keys(ffmpegMaxPictureResolutionMap)) {
  zConfig.shape.ffmpegMaxPictureResolution.parse(parseInt(key));
}

export const ffmpegAudioFormatMap: Record<Config["ffmpegAudioFormat"], string> = {
  opus: "Opus",
  mp3: "MP3",
};
for (const key of Object.keys(ffmpegAudioFormatMap)) {
  zConfig.shape.ffmpegAudioFormat.parse(key);
}

export const ffmpegAudioQualityMap: Record<Config["ffmpegAudioQuality"], string> = {
  "very-low": "Very Low",
  low: "Low",
  medium: "Medium",
  high: "High",
  "very-high": "Very High",
};
for (const key of Object.keys(ffmpegAudioQualityMap)) {
  zConfig.shape.ffmpegAudioQuality.parse(key);
}
