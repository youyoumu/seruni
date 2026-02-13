import { useMemo } from "react";
import { useApi } from "./api";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createKeyring } from "#/util/keyring";

export function useSessions$() {
  const api = useApi();
  const queries = useMemo(() => createKeyring(api), [api]);

  return useSuspenseQuery(queries.sessions.all);
}

export function useActiveSession$() {
  const api = useApi();
  const queries = useMemo(() => createKeyring(api), [api]);

  return useSuspenseQuery(queries.sessions.active);
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
  const queries = useMemo(() => createKeyring(api), [api]);
  return useMutation({
    mutationFn: async (name: string) => {
      await api.request.createSession(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queries.sessions.all.queryKey,
      });
    },
  });
}

export function useDeleteSession() {
  const api = useApi();
  const queryClient = useQueryClient();
  const queries = useMemo(() => createKeyring(api), [api]);
  return useMutation({
    mutationFn: async (id: number) => {
      await api.request.deleteSession(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queries.sessions.all.queryKey,
      });
    },
  });
}
