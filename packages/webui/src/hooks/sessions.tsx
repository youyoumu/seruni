import { useApi } from "./api";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { keyring } from "#/util/keyring";

export function useSessions$() {
  const api = useApi();

  return useSuspenseQuery({
    queryKey: keyring.sessions.all.queryKey,
    queryFn: async () => {
      return await api.request.sessions();
    },
  });
}

export function useActiveSession$() {
  const api = useApi();

  return useSuspenseQuery({
    queryKey: keyring.sessions.active.queryKey,
    queryFn: async () => {
      return await api.request.getActiveSession();
    },
  });
}

export function useSetActiveSession() {
  const api = useApi();
  return useMutation({
    mutationFn: async (id: number) => {
      return await api.request.setActiveSession(id);
    },
  });
}

export function useCreateNewSession() {
  const api = useApi();
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
  const api = useApi();
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
