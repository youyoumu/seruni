import { createContext, useContext, useState } from "react";
import { ReconnectingWebsocket } from "./ReconnectingWebsocket";

const WSCContext = createContext<ReconnectingWebsocket | null>(null);
export const WSCProvider = ({ children }: { children: React.ReactNode }) => {
  const [ws] = useState<ReconnectingWebsocket>(
    new ReconnectingWebsocket({
      name: "wsc",
      url: "ws://localhost:45626/ws",
    }),
  );

  return <WSCContext.Provider value={ws}>{children}</WSCContext.Provider>;
};

export const useWSC = () => {
  const wsc = useContext(WSCContext);
  if (!wsc) {
    throw new Error("useWSC must be used within a WSCProvider");
  }
  return wsc;
};
