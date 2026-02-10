import { useEffect, useState } from "react";
import { useBus } from "./bus";
import type { TextHistory } from "@repo/shared/db";

export function useTextHistory() {
  const api = useBus();
  const [textHistory, setTextHistory] = useState<TextHistory[]>([]);

  useEffect(() => {
    const cleanHandler = api.addPushHandler("text_history", (e) => {
      setTextHistory([...textHistory, e]);
    });

    return () => {
      cleanHandler();
    };
  });

  return [textHistory, setTextHistory] as const;
}
