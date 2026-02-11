import { useEffect, useState } from "react";
import { useBus } from "./bus";
import type { TextHistory } from "@repo/shared/db";
import { useSuspenseQuery } from "@tanstack/react-query";

export function useTextHistory$({ sessionId }: { sessionId: number }) {
  const api = useBus();
  return useSuspenseQuery({
    queryKey: ["textHistory", { sessionId }],
    queryFn: () => {
      const a = api.request.textHistoryBySessionId(sessionId);
      return a;
    },
  });
}

export function useTextHistory() {
  const api = useBus();
  const [textHistory, setTextHistory] = useState<TextHistory[]>([]);

  useEffect(() => {
    console.log("test");
    const cleanHandler = api.handlePush.textHistory((data) => {
      setTextHistory((prev) => [...prev, data]);
    });

    return () => {
      cleanHandler();
    };
  }, []);

  return [textHistory, setTextHistory] as const;
}
