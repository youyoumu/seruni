import { useEffect, useState } from "react";
import { useBus, type ServerBus } from "./bus";
import { type Envelope, type Config } from "@repo/shared/types";

export function useConfig() {
  const [serverBus, clientBus] = useBus();
  const [config, setConfig] = useState<Config>({ workdir: "" });

  useEffect(() => {
    setInterval(async () => {
      const config = await clientBus.request("req_config", "res_config", undefined);
      console.log("DEBUG[1503]: config=", config);
    }, 3000);
  }, []);
}
