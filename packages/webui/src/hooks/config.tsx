import { useEffect, useState } from "react";
import { useBus, type ServerBus } from "./bus";
import { type Envelope, type Config } from "@repo/shared/types";

export function useConfig() {
  const [serverBus, clientBus] = useBus();
  const [config, setConfig] = useState<Config>({ workdir: "" });

  const getConfig = () => {
    const requestId = Math.random().toString(36).substring(7);
    return new Promise<Config>((resolve, reject) => {
      const handler = (ev: CustomEvent<Envelope<Config>>) => {
        if (ev.detail.requestId === requestId) {
          serverBus.removeEventListener("res_config", handler);
          resolve(ev.detail.data);
        }
      };

      serverBus.addEventListener("res_config", handler);

      setTimeout(() => {
        serverBus.removeEventListener("res_config", handler);
        reject(new Error("Timeout"));
      }, 5000);

      clientBus.dispatchTypedEvent(
        "req_config",
        new CustomEvent("req_config", { detail: { requestId, data: undefined } }),
      );
    });
  };

  useEffect(() => {
    setInterval(async () => {
      const config = await getConfig();
      console.log("DEBUG[1503]: config=", config);
    }, 3000);
  }, []);
}
