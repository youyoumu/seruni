import { useEffect, useState } from "react";
import { useBus } from "./bus";
import type { TextHistory } from "@repo/shared/db";
import { useSuspenseQuery } from "@tanstack/react-query";

export function useTextHistory$({ sessionId }: { sessionId: number }) {
  const api = useBus();
  return useSuspenseQuery({
    queryKey: ["textHistory", { sessionId }],
    queryFn: () => {
      const a = api.request("req_text_history_by_session_id", sessionId);
      return a;
    },
  });
}

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
