import { useEffect, useState } from "react";
import { useBus } from "./bus";
import type { ServerPushEventMap } from "@repo/shared/types";

export function useTextHistory() {
  const { serverPushBus } = useBus();
  const [textHistory, setTextHistory] = useState<string[]>(["text"]);

  useEffect(() => {
    const handler = (e: ServerPushEventMap["text_history"]) => {
      setTextHistory([...textHistory, e.detail.data.text]);
    };
    serverPushBus.addEventListener("text_history", handler);
    return () => {
      serverPushBus.removeEventListener("text_history", handler);
    };
  });

  return [textHistory, setTextHistory] as const;
}
