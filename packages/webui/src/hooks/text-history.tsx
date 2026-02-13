import { useEffect } from "react";
import { useServices } from "./api";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

export function useTextHistory$({ sessionId }: { sessionId: number }) {
  const { keyring } = useServices();
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries({
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
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({
          queryKey: keyring.textHistory.bySession(data.sessionId).queryKey,
        });
      }
    },
  });
}
