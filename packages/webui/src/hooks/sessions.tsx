import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { R } from "@praha/byethrow";

import { useServices } from "./services";

export function useSessions$() {
  const { keyring } = useServices();
  return useSuspenseQuery(keyring.sessions.all);
}

export function useActiveSession$() {
  const { keyring } = useServices();
  return useSuspenseQuery(keyring.sessions.active);
}

export function useSession$(sessionId: number) {
  const { keyring } = useServices();
  return useSuspenseQuery(keyring.sessions.byId(sessionId));
}

export function useSetActiveSession() {
  const { api } = useServices();
  return useMutation({
    mutationFn: async (id: number) => {
      return R.unwrap(await api.request["session/active/set"](id));
    },
  });
}

export function useCreateNewSession() {
  const { api, keyring } = useServices();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (name: string) => {
      return R.unwrap(await api.request["session/create"](name));
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: keyring.sessions.all.queryKey,
      });
      await navigate({
        to: "/text-hooker/$sessionId",
        params: { sessionId: data.id },
      });
    },
  });
}

export function useDeleteSession() {
  const { api, keyring } = useServices();
  const queryClient = useQueryClient();
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();

  const active = matchRoute({
    to: "/text-hooker/$sessionId",
  });

  return useMutation({
    mutationFn: async (id: number) => {
      return R.unwrap(await api.request["session/delete"](id));
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: keyring.sessions.all.queryKey,
      });
      if (typeof active === "object" && Number(active.sessionId) === data?.id) {
        await navigate({
          to: "/",
        });
      }
    },
  });
}

export function useUpdateSessionDuration() {
  const { api, keyring } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, duration }: { sessionId: number; duration: number }) => {
      return R.unwrap(await api.request["session/update"]({ id: sessionId, duration }));
    },
    onSuccess: async (data) => {
      if (data) {
        await queryClient.invalidateQueries({
          queryKey: keyring.sessions.byId(data.id).queryKey,
        });
      }
    },
  });
}

export function useIsListeningTextHooker$() {
  const { keyring } = useServices();
  return useSuspenseQuery(keyring.isListeningTextHooker.isListening);
}

export function useSetIsListeningTextHooker() {
  const { api } = useServices();
  return useMutation({
    mutationFn: async (isListening: boolean) => {
      return R.unwrap(await api.request["text-hooker/listening/set"](isListening));
    },
  });
}

export function useIsTextHookerAutoResume$() {
  const { keyring } = useServices();
  return useSuspenseQuery(keyring.isTextHookerAutoResume.isAutoResume);
}

export function useSetIsTextHookerAutoResume() {
  const { api } = useServices();
  return useMutation({
    mutationFn: async (isAutoResume: boolean) => {
      return R.unwrap(await api.request["text-hooker/auto-resume/set"](isAutoResume));
    },
  });
}
