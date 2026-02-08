import { useEffect, useState } from "react";
import { useBus } from "./bus";
import type { ServerPushEventMap } from "@repo/shared/ws";

export function useTextHistory() {
  const api = useBus();
  const [textHistory, setTextHistory] = useState<string[]>(["text"]);

  useEffect(() => {
    const handler = (e: ServerPushEventMap["text_history"]) => {
      setTextHistory([...textHistory, e.detail.text]);
    };

    api.addPushHandler("text_history", handler);

    return () => {
      api.removePushHandler("text_history", handler);
    };
  });

  return [textHistory, setTextHistory] as const;
}
