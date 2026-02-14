import type { Services } from "#/hooks/api";
import { createQueryKeyStore } from "@lukemorales/query-key-factory";

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
      byId: (sessionId: number) => ({
        queryKey: [{ sessionId }],
        queryFn: async () => {
          const result = await api.request.session(sessionId);
          if (!result) throw Error("Session not found");
          return result;
        },
      }),
    },
    textHistory: {
      bySession: (sessionId: number) => ({
        queryKey: [{ sessionId }],
        queryFn: () => api.request.textHistoryBySessionId(sessionId),
      }),
    },
    isListeningTexthooker: {
      isListening: {
        queryKey: null,
        queryFn: () => api.request.isListeningTexthooker(),
      },
    },
  });

export type Keyring = ReturnType<typeof createKeyring>;
