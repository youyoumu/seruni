import { useEffect } from "react";
import { useApi } from "./api";
import type { TextHistory } from "@repo/shared/db";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

export function useTextHistory$({ sessionId }: { sessionId: number }) {
  const api = useApi();
  const queryClient = useQueryClient();

  useEffect(() => {
    return api.handlePush.textHistory((data) => {
      queryClient.setQueryData(["textHistory", { sessionId }], (old: TextHistory[] = []) => {
        return [...old, data];
      });
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
