import { useEffect, useState } from "react";
import { useBus, type Bus } from "./bus";

type Config = {
  workdir: string;
};

export interface Envelope<T> {
  data: T;
  requestId?: string; // Optional: only present for req/res pairs
}

export function useConfig() {
  const bus = useBus();
  const [config, setConfig] = useState<Config>({ workdir: "" });

  const getConfig = () => {
    const requestId = Math.random().toString(36).substring(7);
    return new Promise<Config>((resolve, reject) => {
      const handler = (ev: CustomEvent<Envelope<Config>>) => {
        if (ev.detail.requestId === requestId) {
          bus.removeEventListener("res_config", handler);
          resolve(ev.detail.data);
        }
      };

      bus.addEventListener("res_config", handler);

      setTimeout(() => {
        bus.removeEventListener("res_config", handler);
        reject(new Error("Timeout"));
      }, 5000);

      bus.dispatchTypedEvent(
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
