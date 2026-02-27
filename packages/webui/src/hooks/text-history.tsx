import type { TextHistory } from "@repo/shared/db";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useServices } from "./api";

export function useTextHistory$({ sessionId }: { sessionId: number }) {
  const { keyring } = useServices();
  const queryClient = useQueryClient();

  useEffect(() => {
    void queryClient.invalidateQueries({
      queryKey: keyring.textHistory.bySession(sessionId).queryKey,
    });
  }, [sessionId, keyring, queryClient]);

  return useSuspenseQuery(keyring.textHistory.bySession(sessionId));
}

export function useDeleteTextHistory() {
  const { api, keyring } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      return await api.request.deleteTextHistory(id);
    },
    onSuccess: async (data) => {
      if (data) {
        await queryClient.invalidateQueries({
          queryKey: keyring.textHistory.bySession(data.sessionId).queryKey,
        });
      }
    },
  });
}

export function useCompletedTextHistory$() {
  const { keyring } = useServices();
  return useSuspenseQuery(keyring.textHistory.completed);
}

export function useIsTextHistoryCompleted$(textHistory: TextHistory) {
  const completedTextHistory = useCompletedTextHistory$();
  if (completedTextHistory.data[textHistory.id]) return true;
  return false;
}

export function useMarkTextHistoryAsCompleted() {
  const { api, keyring } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      return await api.request.markTextHistoryAsCompleted(id);
    },
    onSuccess: async (data) => {
      if (data) {
        await queryClient.invalidateQueries({
          queryKey: keyring.textHistory.completed.queryKey,
        });
      }
    },
  });
}
