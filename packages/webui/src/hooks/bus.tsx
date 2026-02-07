import { ReconnectingWebsocket } from "@repo/shared/ws";
import { type ServerResEventMap, type ClientReqEventMap, EVENT_MAP } from "@repo/shared/types";
import { TypedEventTarget } from "typescript-event-target";
import { createContext, useContext } from "react";
import { uid } from "uid";

export class ServerResBus extends TypedEventTarget<ServerResEventMap> {}
export class ClientReqBus extends TypedEventTarget<ClientReqEventMap> {
  request = <C extends keyof ClientReqEventMap, S extends keyof ServerResEventMap>(
    clientEvent: C,
    ...data: undefined extends ClientReqEventMap[C]["detail"]["data"]
      ? [data?: ClientReqEventMap[C]["detail"]["data"]]
      : [data: ClientReqEventMap[C]["detail"]["data"]]
  ) => {
    const requestId = uid();
    const serverEvent = EVENT_MAP[clientEvent];
    type ResponseData = ServerResEventMap[S]["detail"]["data"];

    return new Promise<ResponseData>((resolve) => {
      const handler = (ev: Event) => {
        const customEv = ev as ServerResEventMap[S];
        if (customEv.detail.requestId === requestId) {
          serverResBus.removeEventListener(serverEvent, handler);
          resolve(customEv.detail.data);
        }
      };

      serverResBus.addEventListener(serverEvent, handler);
      clientReqBus.dispatchTypedEvent(
        clientEvent,
        new CustomEvent(clientEvent, {
          detail: { requestId, data: data[0] },
        }),
      );
    });
  };
}

const serverResBus = new ServerResBus();
const clientReqBus = new ClientReqBus();

const ws = new ReconnectingWebsocket({
  url: "ws://localhost:45626/ws",
  logger: {
    info: console.log,
    warn: console.log,
  },
});

ws.addEventListener("message", (e: CustomEventInit) => {
  const payload = JSON.parse(e.detail);
  serverResBus.dispatchTypedEvent(
    payload.type,
    new CustomEvent(payload.type, { detail: payload.data }),
  );
});

clientReqBus.addEventListener("req_config", (e) => {
  ws.send(JSON.stringify({ type: "req_config", data: e.detail }));
});

const BusContext = createContext({ serverResBus, clientReqBus });
export const BusProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <BusContext.Provider value={{ serverResBus, clientReqBus }}>{children}</BusContext.Provider>
  );
};

export const useBus = () => {
  const { serverResBus, clientReqBus } = useContext(BusContext);
  return { serverResBus, clientReqBus } as const;
};
