import { useEffect, useState } from "react";
import { useBus } from "./bus";
import type { ServerResEventMap } from "@repo/shared/types";

export function useTextHistory() {
  const { serverResBus, clientReqBus } = useBus();
  const [textHistory, setTextHistory] = useState<string[]>(["text"]);

  useEffect(() => {
    const handler = (e: ServerResEventMap["text_history"]) => {
      setTextHistory([...textHistory, e.detail.data.text]);
    };
    serverResBus.addEventListener("text_history", handler);
    return () => {
      serverResBus.removeEventListener("text_history", handler);
    };
  });

  return [textHistory, setTextHistory] as const;
}
