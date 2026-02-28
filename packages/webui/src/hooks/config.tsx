import type { Config } from "@repo/shared/schema";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { useServices } from "./services";

export function useConfig$() {
  const { keyring } = useServices();
  return useSuspenseQuery(keyring.config.detail);
}

export function useSetConfig() {
  const { api, keyring } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: Partial<Config>) => {
      const data = await api.request.setConfig(config);
      if (!data) throw Error("Failed to set config");
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: keyring.config.detail.queryKey,
      });
    },
  });
}
