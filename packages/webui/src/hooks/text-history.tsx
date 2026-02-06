import { useEffect, useState } from "react";
import { useBus } from "./bus";
import { type TextHistory } from "@repo/shared/db";

export function useTextHistory() {
  const bus = useBus();
  const [textHistory, setTextHistory] = useState<string[]>(["text"]);

  useEffect(() => {
    const handler = (e: CustomEvent<TextHistory>) => {
      setTextHistory([...textHistory, e.detail.text]);
    };
    bus.addEventListener("text_history", handler);
    return () => {
      bus.removeEventListener("text_history", handler);
    };
  });

  return [textHistory, setTextHistory] as const;
}
