import { useEffect, useState } from "react";
import { useBus } from "./bus";
import { type Config } from "@repo/shared/ws";

export function useConfig() {
  const api = useBus();
  const [config, setConfig] = useState<Config>({ workdir: "" });

  useEffect(() => {
    setInterval(async () => {
      const config = await api.request("req_config");
      console.log("DEBUG[1503]: config=", config);
    }, 3000);

    setInterval(async () => {
      api.push("ping", undefined);
      api.push("ping2", 0);
    }, 3000);
  }, []);
}
