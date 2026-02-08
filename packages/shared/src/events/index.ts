import { TypedEventTarget } from "typescript-event-target";
import { uid } from "uid";

export interface WithReqId<T = undefined> {
  data: T;
  requestId: string;
}

type ClientPushEventMap = Record<string, CustomEvent<unknown>>;
function createClientPushEventMap<T extends ClientPushEventMap>(
  eventList: (keyof T & string)[],
): Record<keyof T & string, keyof T & string> {
  const eventMap: Record<string, string> = {};
  eventList.forEach((key) => {
    eventMap[key] = key;
  });
  return eventMap;
}

type ServerPushEventMap = Record<string, CustomEvent<unknown>>;
function createServerPushEventMap<T extends ServerPushEventMap>(
  eventList: (keyof T & string)[],
): Record<keyof T & string, keyof T & string> {
  const eventMap: Record<string, string> = {};
  eventList.forEach((key) => {
    eventMap[key] = key;
  });
  return eventMap;
}

type ClientReqEventMap = Record<string, CustomEvent<WithReqId<unknown>>>;
type ServerResEventMap = Record<string, CustomEvent<WithReqId<unknown>>>;
function createClientReqEventMap<
  C extends ClientReqEventMap,
  S extends ServerResEventMap,
  M extends Record<keyof C & string, keyof S & string>,
>(eventMap: M): M {
  return eventMap;
}

type ServerReqEventMap = Record<string, CustomEvent<WithReqId<unknown>>>;
type ClientResEventMap = Record<string, CustomEvent<WithReqId<unknown>>>;
function createServerReqEventMap<
  S extends ServerReqEventMap,
  C extends ClientResEventMap,
  M extends Record<keyof S & string, keyof C & string>,
>(eventMap: M) {
  return eventMap;
}

class ClientPushBus<CPush extends ClientPushEventMap> extends TypedEventTarget<CPush> {}
class ServerPushBus<SPush extends ServerPushEventMap> extends TypedEventTarget<SPush> {}

class ServerResBus<SRes extends ServerResEventMap> extends TypedEventTarget<SRes> {}
class ClientReqBus<
  CReq extends ClientReqEventMap,
  SRes extends ServerResEventMap,
  SResBus extends TypedEventTarget<SRes>,
> extends TypedEventTarget<CReq> {
  serverResBus: SResBus;
  clientReqMap: Record<keyof CReq & string, keyof SRes & string>;
  constructor(
    serverResBus: SResBus,
    clientReqMap: Record<keyof CReq & string, keyof SRes & string>,
  ) {
    super();
    this.serverResBus = serverResBus;
    this.clientReqMap = clientReqMap;
  }

  request = <C extends keyof CReq & string, S extends keyof SRes & string>(
    clientEvent: C,
    ...data: undefined extends CReq[C]["detail"]["data"]
      ? [data?: CReq[C]["detail"]["data"]]
      : [data: CReq[C]["detail"]["data"]]
  ) => {
    const requestId = uid();
    const responseEvent = this.clientReqMap[clientEvent] as S;
    type ResponseData = SRes[S]["detail"]["data"];

    return new Promise<ResponseData>((resolve) => {
      const handler = (e: SRes[S]) => {
        if (e.detail.requestId === requestId) {
          this.serverResBus.removeEventListener(responseEvent, handler);
          resolve(e.detail.data);
        }
      };

      this.serverResBus.addEventListener(responseEvent, handler);
      this.dispatchTypedEvent(
        clientEvent,
        new CustomEvent(clientEvent, {
          detail: { requestId, data: data[0] },
        }) as CReq[C],
      );
    });
  };
}

class ClientResBus<CRes extends ClientResEventMap> extends TypedEventTarget<CRes> {}
class ServerReqBus<
  SReq extends ServerReqEventMap,
  CRes extends ClientResEventMap,
  CResBus extends TypedEventTarget<CRes>,
> extends TypedEventTarget<SReq> {
  clientResBus: CResBus;
  serverReqMap: Record<keyof SReq & string, keyof CRes & string>;
  constructor(
    clientResBus: CResBus,
    serverReqMap: Record<keyof SReq & string, keyof CRes & string>,
  ) {
    super();
    this.clientResBus = clientResBus;
    this.serverReqMap = serverReqMap;
  }

  request = <S extends keyof SReq & string, C extends keyof CRes & string>(
    serverEvent: S,
    ...data: undefined extends SReq[S]["detail"]["data"]
      ? [data?: SReq[S]["detail"]["data"]]
      : [data: SReq[S]["detail"]["data"]]
  ) => {
    const requestId = uid();
    const responseEvent = this.serverReqMap[serverEvent] as C;
    type ResponseData = CRes[C]["detail"]["data"];

    return new Promise<ResponseData>((resolve) => {
      const handler = (e: CRes[C]) => {
        if (e.detail.requestId === requestId) {
          this.clientResBus.removeEventListener(responseEvent, handler);
          resolve(e.detail.data);
        }
      };

      this.clientResBus.addEventListener(responseEvent, handler);
      this.dispatchTypedEvent(
        serverEvent,
        new CustomEvent(serverEvent, {
          detail: { requestId, data: data[0] },
        }) as SReq[S],
      );
    });
  };
}

export interface WSPayload {
  type: "push" | "req" | "res";
  tag: string;
  data: unknown;
}

export interface WS {
  send: (data: string) => void;
}

function clientOnWSPayload<
  _CPush extends ClientPushEventMap,
  SPush extends ServerPushEventMap,
  _CReq extends ClientReqEventMap,
  SRes extends ServerResEventMap,
  SReq extends ServerReqEventMap,
  CRes extends ClientResEventMap,
>(
  payload: WSPayload,
  serverPushBus: ServerPushBus<SPush>,
  serverReqBus: ServerReqBus<SReq, CRes, ClientResBus<CRes>>,
  serverResBus: ServerResBus<SRes>,
) {
  if (payload.type === "push") {
    type S = keyof SPush & string;
    const tag = payload.tag as S;
    const data = payload.data as SPush[S]["detail"];
    serverPushBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as SPush[S]);
  }
  if (payload.type === "req") {
    type S = keyof SReq & string;
    const tag = payload.tag as S;
    const data = payload.data as SReq[S]["detail"];
    serverReqBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as SReq[S]);
  }
  if (payload.type === "res") {
    type S = keyof SRes & string;
    const tag = payload.tag as S;
    const data = payload.data as SRes[S]["detail"];
    serverResBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as SRes[S]);
  }
}

function serverOnWSPayload<
  CPush extends ClientPushEventMap,
  _SPush extends ServerPushEventMap,
  CReq extends ClientReqEventMap,
  SRes extends ServerResEventMap,
  _SReq extends ServerReqEventMap,
  CRes extends ClientResEventMap,
>(
  payload: WSPayload,
  clientPushBus: ClientPushBus<CPush>,
  clientReqBus: ClientReqBus<CReq, SRes, ServerResBus<SRes>>,
  clientResBus: ClientResBus<CRes>,
) {
  if (payload.type === "push") {
    type C = keyof CPush & string;
    const tag = payload.tag as C;
    const data = payload.data as CPush[C]["detail"];
    clientPushBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as CPush[C]);
  }
  if (payload.type === "req") {
    type C = keyof CReq & string;
    const tag = payload.tag as C;
    const data = payload.data as CReq[C]["detail"];
    clientReqBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as CReq[C]);
  }
  if (payload.type === "res") {
    type C = keyof CRes & string;
    const tag = payload.tag as C;
    const data = payload.data as CRes[C]["detail"];
    clientResBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as CRes[C]);
  }
}

function setupClientWSForwarder<
  CPush extends ClientPushEventMap,
  _SPush extends ServerPushEventMap,
  CReq extends ClientReqEventMap,
  SRes extends ServerResEventMap,
  SReq extends ServerReqEventMap,
  CRes extends ClientResEventMap,
>(
  ws: WS,
  clientPushMap: Record<keyof CPush & string, keyof CPush & string>,
  clientPushBus: ClientPushBus<CPush>,
  clientReqMap: Record<keyof CReq & string, keyof SRes & string>,
  clientReqBus: ClientReqBus<CReq, SRes, ServerResBus<SRes>>,
  serverReqMap: Record<keyof SReq & string, keyof CRes & string>,
  clientResBus: ClientResBus<CRes>,
) {
  Object.keys(clientPushMap).forEach((tag: keyof CPush & string) => {
    clientPushBus.addEventListener(tag, (e) => {
      const payload: WSPayload = {
        type: "push",
        tag: tag,
        data: e.detail,
      };
      ws.send(JSON.stringify(payload));
    });
  });

  Object.keys(clientReqMap).forEach((tag: keyof CReq & string) => {
    clientReqBus.addEventListener(tag, (e) => {
      const payload: WSPayload = {
        type: "req",
        tag: tag,
        data: e.detail,
      };
      ws.send(JSON.stringify(payload));
    });
  });

  Object.values(serverReqMap).forEach((tag: keyof SReq & string) => {
    clientResBus.addEventListener(tag, (e) => {
      const payload: WSPayload = {
        type: "res",
        tag: tag,
        data: e.detail,
      };
      ws.send(JSON.stringify(payload));
    });
  });
}

function setupServerWSForwarder<
  _CPush extends ClientPushEventMap,
  SPush extends ServerPushEventMap,
  CReq extends ClientReqEventMap,
  SRes extends ServerResEventMap,
  SReq extends ServerReqEventMap,
  CRes extends ClientResEventMap,
>(
  ws: WS,
  serverPushMap: Record<keyof SPush & string, keyof SPush & string>,
  serverPushBus: ServerPushBus<SPush>,
  serverReqMap: Record<keyof SReq & string, keyof CRes & string>,
  serverReqBus: ServerReqBus<SReq, CRes, ClientResBus<CRes>>,
  clientReqMap: Record<keyof CReq & string, keyof SRes & string>,
  serverResBus: ServerResBus<SRes>,
) {
  Object.keys(serverReqMap).forEach((tag: keyof SReq & string) => {
    serverReqBus.addEventListener(tag, (e) => {
      const payload: WSPayload = {
        type: "req",
        tag: tag,
        data: e.detail,
      };
      ws.send(JSON.stringify(payload));
    });
  });

  Object.keys(serverPushMap).forEach((tag: keyof SPush & string) => {
    serverPushBus.addEventListener(tag, (e) => {
      const payload: WSPayload = {
        type: "push",
        tag: tag,
        data: e.detail,
      };
      ws.send(JSON.stringify(payload));
    });
  });

  Object.values(clientReqMap).forEach((tag: keyof CReq & string) => {
    serverResBus.addEventListener(tag, (e) => {
      const payload: WSPayload = {
        type: "res",
        tag: tag,
        data: e.detail,
      };
      ws.send(JSON.stringify(payload));
    });
  });
}

export function createApiClient<
  CPush extends ClientPushEventMap,
  SPush extends ServerPushEventMap,
  CReq extends ClientReqEventMap,
  SRes extends ServerResEventMap,
  SReq extends ServerReqEventMap,
  CRes extends ClientResEventMap,
>(
  side: "client" | "server",
  clientPushEventList: (keyof CPush & string)[],
  serverPushEventList: (keyof SPush & string)[],
  clientReqEventMap: Record<keyof CReq & string, keyof SRes & string>,
  serverReqEventMap: Record<keyof SReq & string, keyof CRes & string>,
) {
  const clientPushMap = createClientPushEventMap(clientPushEventList);
  const serverPushMap = createServerPushEventMap(serverPushEventList);
  const clientReqMap = createClientReqEventMap(clientReqEventMap);
  const serverReqMap = createServerReqEventMap(serverReqEventMap);

  const clientPushBus = new ClientPushBus<CPush>();
  const serverPushBus = new ServerPushBus<SPush>();

  const serverResBus = new ServerResBus<SRes>();
  const clientReqBus = new ClientReqBus<CReq, SRes, ServerResBus<SRes>>(serverResBus, clientReqMap);

  const clientResBus = new ClientResBus<CRes>();
  const serverReqBus = new ServerReqBus<SReq, CRes, ClientResBus<CRes>>(clientResBus, serverReqMap);

  const onPayload =
    side === "client"
      ? (payload: WSPayload) => {
          clientOnWSPayload(payload, serverPushBus, serverReqBus, serverResBus);
        }
      : (payload: WSPayload) => {
          serverOnWSPayload(payload, clientPushBus, clientReqBus, clientResBus);
        };

  const setupWSForwarder =
    side === "client"
      ? (ws: WS) =>
          setupClientWSForwarder(
            ws,
            clientPushMap,
            clientPushBus,
            clientReqMap,
            clientReqBus,
            serverReqMap,
            clientResBus,
          )
      : (ws: WS) =>
          setupServerWSForwarder(
            ws,
            serverPushMap,
            serverPushBus,
            serverReqMap,
            serverReqBus,
            clientReqMap,
            serverResBus,
          );

  const addServerReqHandler = <
    K extends keyof CReq & string,
    V extends (typeof clientReqMap)[K],
    R extends SRes[V]["detail"]["data"],
  >(
    type: K,
    value: (payload: CReq[K]["detail"]["data"]) => R,
  ) => {
    const v = clientReqMap[type];
    const handler = (e: CReq[K]) => {
      serverResBus.dispatchTypedEvent(
        v,
        new CustomEvent(v, {
          detail: {
            data: value(e.detail.data),
            requestId: e.detail.requestId,
          },
        }) as SRes[V],
      );
    };
    clientReqBus.addEventListener(type, handler);
    return handler;
  };

  const addClientReqHandler = <
    K extends keyof SReq & string,
    V extends (typeof serverReqMap)[K],
    R extends CRes[V]["detail"]["data"],
  >(
    type: K,
    value: (payload: SReq[K]["detail"]["data"]) => R,
  ) => {
    const v = serverReqMap[type];
    const handler = (e: SReq[K]) => {
      clientResBus.dispatchTypedEvent(
        v,
        new CustomEvent(v, {
          detail: {
            data: value(e.detail.data),
            requestId: e.detail.requestId,
          },
        }) as CRes[V],
      );
    };
    serverReqBus.addEventListener(type, handler);
    return handler;
  };

  const clientApi = {
    push: clientPushBus.dispatchTypedEvent.bind(clientPushBus),
    addPushHandler: serverPushBus.addEventListener.bind(serverPushBus),
    removePushHandler: serverPushBus.removeEventListener.bind(serverPushBus),
    addReqHandler: addClientReqHandler,
    removeReqHandler: serverReqBus.removeEventListener.bind(serverReqBus),
    request: clientReqBus.request,
  };

  const serverApi = {
    push: serverPushBus.dispatchTypedEvent.bind(serverPushBus),
    addPushHandler: clientPushBus.addEventListener.bind(clientPushBus),
    removePushHandler: clientPushBus.removeEventListener.bind(clientPushBus),
    addReqHandler: addServerReqHandler,
    removeReqHandler: clientReqBus.removeEventListener.bind(clientReqBus),
    request: serverReqBus.request,
  };

  return {
    onPayload,
    setupWSForwarder,
    clientApi,
    serverApi,
  };
}
