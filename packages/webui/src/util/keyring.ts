import type { Services } from "#/hooks/services";
import { createQueryKeyStore } from "@lukemorales/query-key-factory";
import { R } from "@praha/byethrow";

export const createKeyring = (api: Services["api"]) =>
  createQueryKeyStore({
    sessions: {
      all: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["session/list"]()),
      },
      active: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["session/active/get"]()),
      },
      byId: (sessionId: number) => ({
        queryKey: [{ sessionId }],
        queryFn: async () => R.unwrap(await api.request["session/get"](sessionId)),
      }),
    },
    textHistory: {
      bySession: (sessionId: number) => ({
        queryKey: [{ sessionId }],
        queryFn: async () => R.unwrap(await api.request["text-history/by-session/get"](sessionId)),
      }),
      completed: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["text-history/completed/get"]()),
      },
    },
    isListeningTextHooker: {
      isListening: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["text-hooker/listening/get"]()),
      },
    },
    isTextHookerAutoResume: {
      isAutoResume: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["text-hooker/auto-resume/get"]()),
      },
    },
    client: {
      textHookerConnected: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["text-hooker/connected/get"]()),
      },
      ankiConnectConnected: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["anki-connect/connected/get"]()),
      },
      obsConnected: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["obs/connected/get"]()),
      },
    },
    config: {
      detail: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["config/get"]()),
      },
    },
  });

export type Keyring = ReturnType<typeof createKeyring>;
