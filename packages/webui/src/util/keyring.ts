import type { Services } from "#/hooks/services";
import { createQueryKeyStore } from "@lukemorales/query-key-factory";
import { R } from "@praha/byethrow";

export const createKeyring = (api: Services["api"]) =>
  createQueryKeyStore({
    sessions: {
      all: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request.sessions()),
      },
      active: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request.getActiveSession()),
      },
      byId: (sessionId: number) => ({
        queryKey: [{ sessionId }],
        queryFn: async () => R.unwrap(await api.request.session(sessionId)),
      }),
    },
    textHistory: {
      bySession: (sessionId: number) => ({
        queryKey: [{ sessionId }],
        queryFn: async () => R.unwrap(await api.request.textHistoryBySessionId(sessionId)),
      }),
      completed: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request.completedTextHistory()),
      },
    },
    isListeningTextHooker: {
      isListening: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request.isListeningTextHooker()),
      },
    },
    isTextHookerAutoResume: {
      isAutoResume: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request.isTextHookerAutoResume()),
      },
    },
    client: {
      textHookerConnected: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request.textHookerConnected()),
      },
      ankiConnectConnected: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request.ankiConnectConnected()),
      },
      obsConnected: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request.obsConnected()),
      },
    },
    config: {
      detail: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request.config()),
      },
    },
  });

export type Keyring = ReturnType<typeof createKeyring>;
