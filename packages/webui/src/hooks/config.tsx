import { useEffect, useState } from "react";
import { useApi } from "./api";
import { type Config } from "@repo/shared/ws";

export function useConfig() {
  const api = useApi();
  const [config, setConfig] = useState<Config>({ workdir: "" });

  useEffect(() => {
    const id = setInterval(async () => {
      const config = await api.request.config();
      console.log("DEBUG[1503]: config=", config);
    }, 3000);

    const id2 = setInterval(async () => {
      api.push.ping(undefined);
      api.push.ping2(0);
    }, 3000);

    return () => {
      clearInterval(id);
      clearInterval(id2);
    };
  }, []);
}
