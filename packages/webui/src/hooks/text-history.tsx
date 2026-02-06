import { useEffect, useState } from "react";
import { eventTarget } from "#/util/event-target";

export function useTextHistory() {
  const [textHistory, setTextHistory] = useState<string[]>(["text"]);

  useEffect(() => {
    eventTarget.addEventListener("text_history", (e) => {
      setTextHistory([...textHistory, e.detail.text]);
    });
  });

  return [textHistory, setTextHistory] as const;
}
