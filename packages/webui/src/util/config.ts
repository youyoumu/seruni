import type { Config } from "@repo/shared/schema";
import { zConfig } from "@repo/shared/schema";

export const ffmpegPictureFormatMap: Record<Config["ffmpegPictureFormat"], string> = {
  webp: "WebP",
  jpeg: "JPEG",
};
for (const key of Object.keys(ffmpegPictureFormatMap)) {
  zConfig.shape.ffmpegPictureFormat.parse(key);
}

export const ffmpegMaxPictureResolutionMap: Record<Config["ffmpegMaxPictureResolution"], string> = {
  720: "720",
  1080: "1080",
};
for (const key of Object.keys(ffmpegMaxPictureResolutionMap)) {
  zConfig.shape.ffmpegMaxPictureResolution.parse(parseInt(key));
}
