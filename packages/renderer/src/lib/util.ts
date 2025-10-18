import {
  zAnkiCollectionMediaUrlPath,
  zStorageUrlPath,
} from "@repo/preload/ipc";
import { store } from "./store";

export function getMediaUrl(fileName: string, source: "anki" | "storage") {
  if (source === "anki") {
    return `${store.general.httpServerUrl}${zAnkiCollectionMediaUrlPath.value}${fileName}`;
  } else if (source === "storage") {
    return `${store.general.httpServerUrl}${zStorageUrlPath.value}${fileName}`;
  }
  return "";
}
