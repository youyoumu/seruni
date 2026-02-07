import { ReconnectingWebsocket } from "@repo/shared/ws";
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
  const payload = JSON.parse(e.detail);
  bus.push.server.dispatchTypedEvent(
    payload.type,
    new CustomEvent(payload.type, { detail: payload.data }),
  );
});

bus.req.client.addEventListener("req_config", (e) => {
  ws.send(JSON.stringify({ type: "req_config", data: e.detail }));
});

const BusContext = createContext(bus);
export const BusProvider = ({ children }: { children: React.ReactNode }) => {
  return <BusContext.Provider value={bus}>{children}</BusContext.Provider>;
};
export const useBus = () => {
  return useContext(BusContext);
};
