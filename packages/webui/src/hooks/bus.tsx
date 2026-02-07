import { ReconnectingWebsocket } from "@repo/shared/ws";
import { type ServerEventMap, type ClientEventMap } from "@repo/shared/types";
import { TypedEventTarget } from "typescript-event-target";
import { createContext, useContext } from "react";
import { uid } from "uid";

export class ServerBus extends TypedEventTarget<ServerEventMap> {}
export class ClientBus extends TypedEventTarget<ClientEventMap> {
  request = <C extends keyof ClientEventMap, S extends keyof ServerEventMap>(
    clientEvent: C,
    serverEvent: S,
    ...data: undefined extends ClientEventMap[C]["detail"]["data"]
      ? [data?: ClientEventMap[C]["detail"]["data"]]
      : [data: ClientEventMap[C]["detail"]["data"]]
  ) => {
    const requestId = uid();
    type ResponseData = ServerEventMap[S]["detail"]["data"];

    return new Promise<ResponseData>((resolve) => {
      const handler = (ev: Event) => {
        const customEv = ev as ServerEventMap[S];
        if (customEv.detail.requestId === requestId) {
          serverBus.removeEventListener(serverEvent, handler);
          resolve(customEv.detail.data);
        }
      };

      serverBus.addEventListener(serverEvent, handler);
      clientBus.dispatchTypedEvent(
        clientEvent,
        new CustomEvent(clientEvent, {
          detail: { requestId, data: data[0] },
        }),
      );
    });
  };
}

const serverBus = new ServerBus();
const clientBus = new ClientBus();

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
