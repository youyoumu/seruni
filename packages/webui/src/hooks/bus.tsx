import { ReconnectingWebsocket } from "@repo/shared/ws";
import { type ServerEventMap, type ClientEventMap } from "@repo/shared/types";
import { TypedEventTarget } from "typescript-event-target";
import { createContext, useContext } from "react";

const serverBus = new TypedEventTarget<ServerEventMap>();
const clientBus = new TypedEventTarget<ClientEventMap>();

export type ServerBus = TypedEventTarget<ServerEventMap>;
export type ClientBus = TypedEventTarget<ClientEventMap>;

const ws = new ReconnectingWebsocket({
  url: "ws://localhost:45626/ws",
  logger: {
    info: console.log,
    warn: console.log,
  },
});

ws.addEventListener("message", (e: CustomEventInit) => {
  const payload = JSON.parse(e.detail);
  serverBus.dispatchTypedEvent(
    payload.type,
    new CustomEvent(payload.type, { detail: payload.data }),
  );
});

clientBus.addEventListener("req_config", (e) => {
  ws.send(JSON.stringify({ type: "req_config", data: e.detail }));
});

const BusContext = createContext([serverBus, clientBus] as const);
export const BusProvider = ({ children }: { children: React.ReactNode }) => {
  return <BusContext.Provider value={[serverBus, clientBus]}>{children}</BusContext.Provider>;
};

export const useBus = () => {
  const [serverBus, clientBus] = useContext(BusContext);
  return [serverBus, clientBus] as const;
};
