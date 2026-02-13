import { useEffect, useMemo } from "react";
import { useApi } from "./api";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createKeyring } from "#/util/keyring";

export function useTextHistory$({ sessionId }: { sessionId: number }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const queries = useMemo(() => createKeyring(api), [api]);

  useEffect(() => {
    queryClient.invalidateQueries({
      queryKey: queries.textHistory.bySession(sessionId).queryKey,
    });
  }, [sessionId, queries, queryClient]);

  return useSuspenseQuery(queries.textHistory.bySession(sessionId));
}

export function useDeleteTextHistory() {
  const api = useApi();
  const queryClient = useQueryClient();
  const queries = useMemo(() => createKeyring(api), [api]);
  return useMutation({
    mutationFn: async (id: number) => {
      return await api.request.deleteTextHistory(id);
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({
          queryKey: queries.textHistory.bySession(data.sessionId).queryKey,
        });
      }
    },
  });
}
