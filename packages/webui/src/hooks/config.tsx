import { R } from "@praha/byethrow";
import type { Config } from "@repo/shared/schema";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { useServices } from "./services";

export function useConfig$() {
  const { keyring } = useServices();
  return useSuspenseQuery(keyring.config.get);
}

export function useSetConfig() {
  const { api, keyring } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: Config) => {
      const data = R.unwrap(await api.request["config/set"](config));
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: keyring.config.get.queryKey,
      });
    },
  });
}
