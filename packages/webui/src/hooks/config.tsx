import { useEffect, useState } from "react";
import { useBus } from "./bus";
import { type Config } from "@repo/shared/types";

export function useConfig() {
  const bus = useBus();
  const [config, setConfig] = useState<Config>({ workdir: "" });

  useEffect(() => {
    setInterval(async () => {
      const config = await bus.req.client.request("req_config");
      console.log("DEBUG[1503]: config=", config);
    }, 3000);
  }, []);
}
