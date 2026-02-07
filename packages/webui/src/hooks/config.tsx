import { useEffect, useState } from "react";
import { useBus } from "./bus";
import { type Config } from "@repo/shared/types";

export function useConfig() {
  const bus = useBus();
  const [config, setConfig] = useState<Config>({ workdir: "" });

  useEffect(() => {
    setInterval(async () => {
      const config = await bus.client.req.request("req_config");
      console.log("DEBUG[1503]: config=", config);
    }, 3000);

    setInterval(async () => {
      bus.client.push.dispatchTypedEvent("ping", new CustomEvent("ping"));
    }, 3000);
  }, []);
}
