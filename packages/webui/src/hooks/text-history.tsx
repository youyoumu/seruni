import { useEffect } from "react";
import { useApi } from "./api";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

export function useTextHistory$({ sessionId }: { sessionId: number }) {
  const api = useApi();
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries({
      queryKey: ["textHistory", { sessionId }],
    });
  }, []);

  return useSuspenseQuery({
    queryKey: ["textHistory", { sessionId }],
    queryFn: async () => {
      const a = await api.request.textHistoryBySessionId(sessionId);
      return a;
    },
  });
}

export function useDeleteTextHistory() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      return await api.request.deleteTextHistory(id);
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({
          queryKey: ["textHistory", { sessionId: data.sessionId }],
        });
      }
    },
  });
}
