import { signal } from "alien-signals";

export type State = ReturnType<typeof createState>;
export function createState() {
  return {
    activeSessionId: signal<number | null>(null),
  };
}
