import type { AnkiHistory } from "@repo/preload/ipc";
import { createStore } from "solid-js/store";

export const [history, setHistory] = createStore<AnkiHistory>([]);
