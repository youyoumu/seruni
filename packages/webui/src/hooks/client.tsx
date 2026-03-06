import { useSuspenseQuery } from "@tanstack/react-query";

import { useServices } from "./services";

export function useTextHookerConnected$() {
  const { keyring } = useServices();
  return useSuspenseQuery(keyring.textHooker.connected);
}

export function useAnkiConnectConnected$() {
  const { keyring } = useServices();
  return useSuspenseQuery(keyring.ankiConnect.connected);
}

export function useObsConnected$() {
  const { keyring } = useServices();
  return useSuspenseQuery(keyring.obs.connected);
}
