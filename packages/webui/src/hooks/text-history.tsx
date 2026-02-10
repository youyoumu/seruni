import { useEffect, useState } from "react";
import { useBus } from "./bus";
import type { TextHistory } from "@repo/shared/db";

export function useTextHistory() {
  const api = useBus();
  const [textHistory, setTextHistory] = useState<TextHistory[]>([]);

  useEffect(() => {
    console.log("test");
    const cleanHandler = api.addPushHandler("text_history", (data) => {
      setTextHistory((prev) => [...prev, data]);
    });

    return () => {
      cleanHandler();
    };
  }, []);

  return [textHistory, setTextHistory] as const;
}
