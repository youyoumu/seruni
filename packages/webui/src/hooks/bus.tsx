import { ReconnectingWebsocket, type WSPayload } from "@repo/shared/ws";
import {
  type ClientPushEventMap,
  type ClientReqEventMap,
  type ServerPushEventMap,
  type ServerReqEventMap,
  type ServerResEventMap,
  CLIENT_PUSH_MAP,
  CLIENT_REQ_MAP,
  SERVER_REQ_MAP,
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
    client: {
      push: clientPushBus,
      req: clientReqBus,
      res: clientResBus,
    },
    server: {
      push: serverPushBus,
      req: serverReqBus,
      res: serverResBus,
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
  if (payload.type === "req") {
    const tag = payload.tag as keyof ServerReqEventMap;
    const data = payload.data as ServerReqEventMap[keyof ServerReqEventMap]["detail"];
    bus.server.req.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }));
  }
  if (payload.type === "res") {
    const tag = payload.tag as keyof ServerResEventMap;
    const data = payload.data as ServerResEventMap[keyof ServerResEventMap]["detail"];
    bus.server.res.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }));
  }
  if (payload.type === "push") {
    const tag = payload.tag as keyof ServerPushEventMap;
    const data = payload.data as ServerPushEventMap[keyof ServerPushEventMap]["detail"];
    bus.server.push.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }));
  }
});

Object.keys(CLIENT_REQ_MAP).forEach((key) => {
  const tag = key as keyof ClientReqEventMap;
  bus.client.req.addEventListener(tag, (e) => {
    const payload: WSPayload = {
      type: "req",
      tag: tag,
      data: e.detail,
    };
    ws.send(JSON.stringify(payload));
  });
});

Object.keys(CLIENT_PUSH_MAP).forEach((key) => {
  const tag = key as keyof ClientPushEventMap;
  bus.client.push.addEventListener(tag, (e) => {
    const payload: WSPayload = {
      type: "push",
      tag: tag,
      data: e.detail,
    };
    ws.send(JSON.stringify(payload));
  });
});

Object.values(SERVER_REQ_MAP).forEach((key) => {
  bus.client.res.addEventListener(key, (e) => {
    const payload: WSPayload = {
      type: "res",
      tag: key,
      data: e.detail,
    };
    ws.send(JSON.stringify(payload));
  });
});

bus.server.req.addEventListener("req_user_agent", (e) => {
  bus.client.res.dispatchTypedEvent(
    "res_user_agent",
    new CustomEvent("res_user_agent", {
      detail: { data: navigator.userAgent, requestId: e.detail.requestId },
    }),
  );
});

const BusContext = createContext(bus);
export const BusProvider = ({ children }: { children: React.ReactNode }) => {
  return <BusContext.Provider value={bus}>{children}</BusContext.Provider>;
};
export const useBus = () => {
  return useContext(BusContext);
};
