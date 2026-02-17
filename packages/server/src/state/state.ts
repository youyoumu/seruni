import { signal } from "alien-signals";

export type State = ReturnType<typeof createState>;
export function createState() {
  return {
    activeSessionId: signal<number | null>(null),
    isListeningTexthooker: signal<boolean>(false),
    textHookerConnected: signal<boolean>(false),
    ankiConnectConnected: signal<boolean>(false),
    obsConnected: signal<boolean>(false),
  };
}
