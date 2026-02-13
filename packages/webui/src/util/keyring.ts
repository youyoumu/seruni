import { createQueryKeyStore } from "@lukemorales/query-key-factory";
import type { Services } from "#/hooks/api";

export const createKeyring = (api: Services["api"]) =>
  createQueryKeyStore({
    sessions: {
      all: {
        queryKey: null,
        queryFn: () => api.request.sessions(),
      },
      active: {
        queryKey: null,
        queryFn: () => api.request.getActiveSession(),
      },
    },
    textHistory: {
      bySession: (sessionId: number) => ({
        queryKey: [{ sessionId }],
        queryFn: () => api.request.textHistoryBySessionId(sessionId),
      }),
    },
  });

export type Keyring = ReturnType<typeof createKeyring>;
