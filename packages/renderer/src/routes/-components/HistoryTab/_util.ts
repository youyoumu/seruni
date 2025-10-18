import type { AnkiHistory } from "@repo/preload/ipc";
import { createStore } from "solid-js/store";

export const [history, setHistory] = createStore<AnkiHistory>([]);

export const srcSet = new Set<string>();
export const nsfwUpdateLock = new Set<number>();
