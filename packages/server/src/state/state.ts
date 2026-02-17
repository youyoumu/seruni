import path from "node:path";

import { zConfig } from "@repo/shared/schema";
import { signal } from "alien-signals";

export type State = ReturnType<typeof createState>;
export function createState({
  workdir = process.cwd(),
}: {
  workdir?: string;
} = {}) {
  const config = zConfig.parse({});
  const path_ = {
    db: path.join(path.resolve(workdir), "./db.sqlite"),
  };

  return {
    activeSessionId: signal<number | null>(null),
    isListeningTexthooker: signal<boolean>(false),
    textHookerConnected: signal<boolean>(false),
    ankiConnectConnected: signal<boolean>(false),
    obsConnected: signal<boolean>(false),
    config: signal(config),
    path: signal(path_),
  };
}

export function serializeState(state: State) {
  const result = {} as Record<string, unknown>;
  for (const key in state) {
    const property = state[key as keyof State];
    if (typeof property === "function") {
      result[key] = property();
    } else {
      result[key] = property;
    }
  }
  return result;
}
