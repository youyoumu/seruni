import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

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
  return useMutation({
    mutationFn: async (name: string) => {
      await api.request.createSession(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: keyring.sessions.all.queryKey,
      });
    },
  });
}

export function useDeleteSession() {
  const { api, keyring } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.request.deleteSession(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: keyring.sessions.all.queryKey,
      });
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
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({
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
