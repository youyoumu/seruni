import type { Services } from "#/hooks/services";
import { createQueryKeyStore } from "@lukemorales/query-key-factory";
import { R } from "@praha/byethrow";

export const createKeyring = (api: Services["api"]) =>
  createQueryKeyStore({
    session: {
      list: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["session/list"]()),
      },
      active: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["session/active/get"]()),
      },
      get: (id: number) => ({
        queryKey: [id],
        queryFn: async () => R.unwrap(await api.request["session/get"](id)),
      }),
    },
    textHistory: {
      bySession: (sessionId: number) => ({
        queryKey: [sessionId],
        queryFn: async () => R.unwrap(await api.request["text-history/by-session/get"](sessionId)),
      }),
      completed: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["text-history/completed/get"]()),
      },
    },
    textHooker: {
      listening: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["text-hooker/listening/get"]()),
      },
      autoResume: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["text-hooker/auto-resume/get"]()),
      },
      connected: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["text-hooker/connected/get"]()),
      },
    },
    ankiConnect: {
      connected: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["anki-connect/connected/get"]()),
      },
    },
    obs: {
      connected: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["obs/connected/get"]()),
      },
    },
    config: {
      get: {
        queryKey: null,
        queryFn: async () => R.unwrap(await api.request["config/get"]()),
      },
    },
  });

export type Keyring = ReturnType<typeof createKeyring>;
