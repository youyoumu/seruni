import { useEffect, useState } from "react";
import { useBus } from "./bus";
import type { ServerEventMap } from "@repo/shared/types";

export function useTextHistory() {
  const [serverBus] = useBus();
  const [textHistory, setTextHistory] = useState<string[]>(["text"]);

  useEffect(() => {
    const handler = (e: ServerEventMap["text_history"]) => {
      setTextHistory([...textHistory, e.detail.data.text]);
    };
    serverBus.addEventListener("text_history", handler);
    return () => {
      serverBus.removeEventListener("text_history", handler);
    };
  });

  return [textHistory, setTextHistory] as const;
}
