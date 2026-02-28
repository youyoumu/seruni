import type { Services } from "#/hooks/services";
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
      completed: {
        queryKey: null,
        queryFn: () => api.request.completedTextHistory(),
      },
    },
    isListeningTexthooker: {
      isListening: {
        queryKey: null,
        queryFn: () => api.request.isListeningTexthooker(),
      },
    },
    client: {
      textHookerConnected: {
        queryKey: null,
        queryFn: () => api.request.textHookerConnected(),
      },
      ankiConnectConnected: {
        queryKey: null,
        queryFn: () => api.request.ankiConnectConnected(),
      },
      obsConnected: {
        queryKey: null,
        queryFn: () => api.request.obsConnected(),
      },
    },
  });

export type Keyring = ReturnType<typeof createKeyring>;
