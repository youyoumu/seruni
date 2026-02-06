import { createContext, useContext, useEffect, useState } from "react";
import { ReconnectingWebsocket } from "./ReconnectingWebsocket";
import { type AppEventMap } from "@repo/shared/types";
import { TypedEventTarget } from "typescript-event-target";

const WSCContext = createContext<ReconnectingWebsocket | null>(null);

export const eventTarget = new TypedEventTarget<AppEventMap>();

const ws = new ReconnectingWebsocket({
  name: "wsc",
  url: "ws://localhost:45626/ws",
});

export const WSCProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    ws.addEventListener("message", (e: CustomEventInit) => {
      console.log(e.detail);
    });
  });

  return <WSCContext.Provider value={ws}>{children}</WSCContext.Provider>;
};

export const useWSC = () => {
  const wsc = useContext(WSCContext);
  if (!wsc) {
    throw new Error("useWSC must be used within a WSCProvider");
  }
  return wsc;
};
