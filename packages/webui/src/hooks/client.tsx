import { useSuspenseQuery } from "@tanstack/react-query";

import { useServices } from "./api";

export function useTextHookerConnected$() {
  const { keyring } = useServices();
  return useSuspenseQuery(keyring.client.textHookerConnected);
}

export function useAnkiConnectConnected$() {
  const { keyring } = useServices();
  return useSuspenseQuery(keyring.client.ankiConnectConnected);
}

export function useObsConnected$() {
  const { keyring } = useServices();
  return useSuspenseQuery(keyring.client.obsConnected);
}
