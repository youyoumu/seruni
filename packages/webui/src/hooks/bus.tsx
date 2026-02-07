import { ReconnectingWebsocket, type WSPayload } from "@repo/shared/ws";
import {
  type ClientReqEventMap,
  type ServerPushEventMap,
  type ServerResEventMap,
} from "@repo/shared/types";
import { createContext, useContext } from "react";

import {
  ClientPushBus,
  ServerPushBus,
  ClientReqBus,
  ServerResBus,
  ServerReqBus,
  ClientResBus,
} from "@repo/shared/events";

function createBusCenter() {
  const clientPushBus = new ClientPushBus();
  const serverPushBus = new ServerPushBus();

  const serverResBus = new ServerResBus();
  const clientReqBus = new ClientReqBus(serverResBus);

  const clientResBus = new ClientResBus();
  const serverReqBus = new ServerReqBus(clientResBus);

  return {
    push: {
      client: clientPushBus,
      server: serverPushBus,
    },
    req: {
      client: clientReqBus,
      server: serverReqBus,
    },
    res: {
      client: clientResBus,
      server: serverResBus,
    },
  };
}

const bus = createBusCenter();

const ws = new ReconnectingWebsocket({
  url: "ws://localhost:45626/ws",
  logger: {
    info: console.log,
    warn: console.log,
  },
});

ws.addEventListener("message", (e: CustomEventInit) => {
  const payload: WSPayload = JSON.parse(e.detail);
  if (payload.type === "push") {
    const tag = payload.tag as keyof ServerPushEventMap;
    const data = payload.data as ServerPushEventMap[keyof ServerPushEventMap]["detail"];
    bus.push.server.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }));
  }
  if (payload.type === "res") {
    const tag = payload.tag as keyof ServerResEventMap;
    const data = payload.data as ServerResEventMap[keyof ServerResEventMap]["detail"];
    bus.res.server.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }));
  }
  if (payload.type === "req") {
    const tag = payload.tag as keyof ClientReqEventMap;
    const data = payload.data as ClientReqEventMap[keyof ClientReqEventMap]["detail"];
    bus.req.client.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }));
  }
});

bus.req.client.addEventListener("req_config", (e) => {
  const payload: WSPayload = {
    type: "req",
    tag: "req_config",
    data: e.detail,
  };
  ws.send(JSON.stringify(payload));
});

const BusContext = createContext(bus);
export const BusProvider = ({ children }: { children: React.ReactNode }) => {
  return <BusContext.Provider value={bus}>{children}</BusContext.Provider>;
};
export const useBus = () => {
  return useContext(BusContext);
};
