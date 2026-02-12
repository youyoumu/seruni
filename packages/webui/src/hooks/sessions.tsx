import { useApi } from "./api";
import { useSuspenseQuery } from "@tanstack/react-query";

export function useSessions$() {
  const api = useApi();

  return useSuspenseQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      return await api.request.sessions();
    },
  });
}
