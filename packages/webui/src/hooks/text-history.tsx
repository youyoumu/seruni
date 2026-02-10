import { useEffect, useState } from "react";
import { useBus } from "./bus";

export function useTextHistory() {
  const api = useBus();
  const [textHistory, setTextHistory] = useState<string[]>([]);

  useEffect(() => {
    const cleanHandler = api.addPushHandler("text_history", (e) => {
      setTextHistory([...textHistory, e.text]);
    });

    return () => {
      cleanHandler();
    };
  });

  return [textHistory, setTextHistory] as const;
}
