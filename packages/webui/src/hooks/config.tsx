import { useEffect, useState } from "react";
import { useBus } from "./bus";
import { type Config } from "@repo/shared/events";

export function useConfig() {
  const bus = useBus();
  const api = bus.client.api;
  const [config, setConfig] = useState<Config>({ workdir: "" });

  useEffect(() => {
    setInterval(async () => {
      const config = await api.request("req_config");
      console.log("DEBUG[1503]: config=", config);
    }, 3000);

    setInterval(async () => {
      api.push("ping", new CustomEvent("ping"));
    }, 3000);
  }, []);
}
