import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";

import { useServices } from "./api";

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
      return await api.request.setActiveSession(id);
    },
  });
}

export function useCreateNewSession() {
  const { api, keyring } = useServices();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (name: string) => {
      return await api.request.createSession(name);
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
      return await api.request.deleteSession(id);
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
      return await api.request.updateSession({ id: sessionId, duration });
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

export function useIsListeningTexthooker$() {
  const { keyring } = useServices();
  return useSuspenseQuery(keyring.isListeningTexthooker.isListening);
}

export function useSetIsListeningTexthooker() {
  const { api } = useServices();
  return useMutation({
    mutationFn: async (isListening: boolean) => {
      return await api.request.setIsListeningTexthooker(isListening);
    },
  });
}
