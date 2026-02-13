import { createQueryKeyStore } from "@lukemorales/query-key-factory";

export const keyring = createQueryKeyStore({
  sessions: {
    all: null,
    active: null,
  },
  textHistory: {
    bySession: (sessionId: number) => [{ sessionId }],
  },
});
