import { TypedEventTarget } from "typescript-event-target";
import type {
  ServerPushEventMap,
  ServerResEventMap,
  ClientReqEventMap,
  ClientPushEventMap,
  ServerReqEventMap,
  ClientResEventMap,
} from "../types/index.ts";
import {
  CLIENT_PUSH_MAP,
  CLIENT_REQ_MAP,
  SERVER_PUSH_MAP,
  SERVER_REQ_MAP,
} from "../types/index.ts";
import { uid } from "uid";
import type { WSPayload } from "#/ws/index.ts";

export class ClientPushBus extends TypedEventTarget<ClientPushEventMap> {}
export class ServerPushBus extends TypedEventTarget<ServerPushEventMap> {}

export class ClientReqBus extends TypedEventTarget<ClientReqEventMap> {
  serverResBus: ServerResBus;
  constructor(serverResBus: ServerResBus) {
    super();
    this.serverResBus = serverResBus;
  }

  request = <C extends keyof ClientReqEventMap, S extends keyof ServerResEventMap>(
    clientEvent: C,
    ...data: undefined extends ClientReqEventMap[C]["detail"]["data"]
      ? [data?: ClientReqEventMap[C]["detail"]["data"]]
      : [data: ClientReqEventMap[C]["detail"]["data"]]
  ) => {
    const requestId = uid();
    const responseEvent = CLIENT_REQ_MAP[clientEvent];
    type ResponseData = ServerResEventMap[S]["detail"]["data"];

    return new Promise<ResponseData>((resolve) => {
      const handler = (ev: Event) => {
        const customEv = ev as ServerResEventMap[S];
        if (customEv.detail.requestId === requestId) {
          this.serverResBus.removeEventListener(responseEvent, handler);
          resolve(customEv.detail.data);
        }
      };

      this.serverResBus.addEventListener(responseEvent, handler);
      this.dispatchTypedEvent(
        clientEvent,
        new CustomEvent(clientEvent, {
          detail: { requestId, data: data[0] },
        }),
      );
    });
  };
}
export class ServerResBus extends TypedEventTarget<ServerResEventMap> {}

export class ServerReqBus extends TypedEventTarget<ServerReqEventMap> {
  clientResBus: ClientResBus;
  constructor(clientResBus: ClientResBus) {
    super();
    this.clientResBus = clientResBus;
  }

  request = <S extends keyof ServerReqEventMap, C extends keyof ClientResEventMap>(
    serverEvent: S,
    ...data: undefined extends ServerReqEventMap[S]["detail"]["data"]
      ? [data?: ServerReqEventMap[S]["detail"]["data"]]
      : [data: ServerReqEventMap[S]["detail"]["data"]]
  ) => {
    const requestId = uid();
    const responseEvent = SERVER_REQ_MAP[serverEvent];
    type ResponseData = ClientResEventMap[C]["detail"]["data"];

    return new Promise<ResponseData>((resolve) => {
      const handler = (ev: Event) => {
        const customEv = ev as ClientResEventMap[C];
        if (customEv.detail.requestId === requestId) {
          this.clientResBus.removeEventListener(responseEvent, handler);
          resolve(customEv.detail.data);
        }
      };

      this.clientResBus.addEventListener(responseEvent, handler);
      this.dispatchTypedEvent(
        serverEvent,
        new CustomEvent(serverEvent, {
          detail: { requestId, data: data[0] },
        }),
      );
    });
  };
}

export class ClientResBus extends TypedEventTarget<ClientResEventMap> {}

export type BusCenter = ReturnType<typeof createBusCenter>;

export function createBusCenter() {
  const clientPushBus = new ClientPushBus();
  const serverPushBus = new ServerPushBus();

  const serverResBus = new ServerResBus();
  const clientReqBus = new ClientReqBus(serverResBus);

  const clientResBus = new ClientResBus();
  const serverReqBus = new ServerReqBus(clientResBus);

  const bus = {
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
    api: {
      push: serverPushBus.dispatchTypedEvent,
      onpush: serverPushBus.addEventListener,
    },
  };

  const addServerReqHandler = <
    K extends keyof ClientReqEventMap,
    V extends (typeof CLIENT_REQ_MAP)[K],
    R extends ServerResEventMap[V]["detail"]["data"],
  >(
    type: K,
    value: (payload: ClientReqEventMap[K]["detail"]["data"]) => R,
  ) => {
    const v = CLIENT_REQ_MAP[type];
    const handler = (e: ClientReqEventMap[K]) => {
      bus.server.res.dispatchTypedEvent(
        v,
        new CustomEvent(v, {
          detail: {
            data: value(e.detail.data),
            requestId: e.detail.requestId,
          },
        }),
      );
    };
    bus.client.req.addEventListener(type, handler);
    return handler;
  };

  const addClientReqHandler = <
    K extends keyof ServerReqEventMap,
    V extends (typeof SERVER_REQ_MAP)[K],
    R extends ClientResEventMap[V]["detail"]["data"],
  >(
    type: K,
    value: (payload: ServerReqEventMap[K]["detail"]["data"]) => R,
  ) => {
    const v = SERVER_REQ_MAP[type];
    const handler = (e: ServerReqEventMap[K]) => {
      bus.client.res.dispatchTypedEvent(
        v,
        new CustomEvent(v, {
          detail: {
            data: value(e.detail.data),
            requestId: e.detail.requestId,
          },
        }),
      );
    };
    bus.server.req.addEventListener(type, handler);
    return handler;
  };

  return {
    client: {
      push: clientPushBus,
      req: clientReqBus,
      res: clientResBus,
      api: {
        push: clientPushBus.dispatchTypedEvent.bind(clientPushBus),
        addPushHandler: serverPushBus.addEventListener.bind(serverPushBus),
        removePushHandler: serverPushBus.removeEventListener.bind(serverPushBus),
        addReqHandler: addClientReqHandler,
        removeReqHandler: serverReqBus.removeEventListener.bind(serverReqBus),
        request: clientReqBus.request,
      },
    },
    server: {
      push: serverPushBus,
      req: serverReqBus,
      res: serverResBus,
      api: {
        push: serverPushBus.dispatchTypedEvent.bind(serverPushBus),
        addPushHandler: clientPushBus.addEventListener.bind(clientPushBus),
        removePushHandler: clientPushBus.removeEventListener.bind(clientPushBus),
        addReqHandler: addServerReqHandler,
        removeReqHandler: clientReqBus.removeEventListener.bind(clientReqBus),
        request: serverReqBus.request,
      },
    },
  };
}

export function serverOnMessage(payload: WSPayload, bus: BusCenter) {
  if (payload.type === "req") {
    const tag = payload.tag as keyof ClientReqEventMap;
    const data = payload.data as ClientReqEventMap[keyof ClientReqEventMap]["detail"];
    bus.client.req.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }));
  }
  if (payload.type === "res") {
    const tag = payload.tag as keyof ClientResEventMap;
    const data = payload.data as ClientResEventMap[keyof ClientResEventMap]["detail"];
    bus.client.res.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }));
  }
  if (payload.type === "push") {
    const tag = payload.tag as keyof ClientPushEventMap;
    const data = payload.data as ClientPushEventMap[keyof ClientPushEventMap]["detail"];
    bus.client.push.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }));
  }
}

interface WS {
  send(data: string): void;
}

export function serverOnOpen(bus: BusCenter, ws: WS) {
  Object.keys(SERVER_REQ_MAP).forEach((key) => {
    const tag = key as keyof ServerReqEventMap;
    bus.server.req.addEventListener(tag, (e) => {
      const payload: WSPayload = {
        type: "req",
        tag: tag,
        data: e.detail,
      };
      ws.send(JSON.stringify(payload));
    });
  });

  Object.keys(SERVER_PUSH_MAP).forEach((key) => {
    const tag = key as keyof ServerPushEventMap;
    bus.server.push.addEventListener(tag, (e) => {
      const payload: WSPayload = {
        type: "push",
        tag: tag,
        data: e.detail,
      };
      ws.send(JSON.stringify(payload));
    });
  });

  Object.values(CLIENT_REQ_MAP).forEach((key) => {
    bus.server.res.addEventListener(key, (e) => {
      const payload: WSPayload = {
        type: "res",
        tag: key,
        data: e.detail,
      };
      ws.send(JSON.stringify(payload));
    });
  });
}

export function clientOnMessage(payload: WSPayload, bus: BusCenter) {
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
}

export function clientOnOpen(bus: BusCenter, ws: WS) {
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
}
