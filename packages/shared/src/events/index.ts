import { TypedEventTarget } from "typescript-event-target";
import { uid } from "uid";

export interface WithReqId<T = undefined> {
  data: T;
  requestId: string;
}

type ClientPushEventMap = Record<string, CustomEvent<unknown>>;
type ServerPushEventMap = Record<string, CustomEvent<unknown>>;

type ClientReqEventMap = Record<string, CustomEvent<WithReqId<unknown>>>;
type ServerResEventMap = Record<string, CustomEvent<WithReqId<unknown>>>;

type ServerReqEventMap = Record<string, CustomEvent<WithReqId<unknown>>>;
type ClientResEventMap = Record<string, CustomEvent<WithReqId<unknown>>>;

class ClientPushBus<CPush extends ClientPushEventMap> extends TypedEventTarget<CPush> {
  push = <T extends keyof CPush & string>(
    tag: T,
    ...payload: undefined extends CPush[T]["detail"]
      ? [payload?: CPush[T]["detail"]]
      : [payload: CPush[T]["detail"]]
  ) => {
    this.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: payload[0] }) as CPush[T]);
  };
}
class ServerPushBus<SPush extends ServerPushEventMap> extends TypedEventTarget<SPush> {
  push = <T extends keyof SPush & string>(
    tag: T,
    ...payload: undefined extends SPush[T]["detail"]
      ? [payload?: SPush[T]["detail"]]
      : [payload: SPush[T]["detail"]]
  ) => {
    this.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: payload[0] }) as SPush[T]);
  };
}

class ServerResBus<SRes extends ServerResEventMap> extends TypedEventTarget<SRes> {}
class ClientReqBus<
  CReq extends ClientReqEventMap,
  SRes extends ServerResEventMap,
  SResBus extends ServerResBus<SRes>,
> extends TypedEventTarget<CReq> {
  sResBus: SResBus;
  cReqPair: Record<keyof CReq & string, keyof SRes & string>;
  constructor(sResBus: SResBus, cReqPair: Record<keyof CReq & string, keyof SRes & string>) {
    super();
    this.sResBus = sResBus;
    this.cReqPair = cReqPair;
  }

  request = <C extends keyof CReq & string, S extends keyof SRes & string>(
    clientEvent: C,
    ...data: undefined extends CReq[C]["detail"]["data"]
      ? [data?: CReq[C]["detail"]["data"]]
      : [data: CReq[C]["detail"]["data"]]
  ) => {
    const requestId = uid();
    const responseEvent = this.cReqPair[clientEvent] as S;
    type ResponseData = SRes[S]["detail"]["data"];

    return new Promise<ResponseData>((resolve) => {
      const handler = (e: SRes[S]) => {
        if (e.detail.requestId === requestId) {
          this.sResBus.removeEventListener(responseEvent, handler);
          resolve(e.detail.data);
        }
      };

      this.sResBus.addEventListener(responseEvent, handler);
      this.dispatchTypedEvent(
        clientEvent,
        new CustomEvent(clientEvent, {
          detail: { requestId, data: data[0] },
        }) as CReq[C],
      );
    });
  };

  addReqHandler = <
    K extends keyof CReq & string,
    V extends (typeof this.cReqPair)[K],
    R extends SRes[V]["detail"]["data"],
  >(
    type: K,
    value: (payload: CReq[K]["detail"]["data"]) => R,
  ) => {
    const v = this.cReqPair[type];
    const handler = (e: CReq[K]) => {
      this.sResBus.dispatchTypedEvent(
        v,
        new CustomEvent(v, {
          detail: {
            data: value(e.detail.data),
            requestId: e.detail.requestId,
          },
        }) as SRes[V],
      );
    };
    this.addEventListener(type, handler);
    return handler;
  };
}

class ClientResBus<CRes extends ClientResEventMap> extends TypedEventTarget<CRes> {}
class ServerReqBus<
  SReq extends ServerReqEventMap,
  CRes extends ClientResEventMap,
  CResBus extends ClientResBus<CRes>,
> extends TypedEventTarget<SReq> {
  cResBus: CResBus;
  sReqPair: Record<keyof SReq & string, keyof CRes & string>;
  constructor(cResBus: CResBus, sReqPair: Record<keyof SReq & string, keyof CRes & string>) {
    super();
    this.cResBus = cResBus;
    this.sReqPair = sReqPair;
  }

  request = <S extends keyof SReq & string, C extends keyof CRes & string>(
    serverEvent: S,
    ...data: undefined extends SReq[S]["detail"]["data"]
      ? [data?: SReq[S]["detail"]["data"]]
      : [data: SReq[S]["detail"]["data"]]
  ) => {
    const requestId = uid();
    const responseEvent = this.sReqPair[serverEvent] as C;
    type ResponseData = CRes[C]["detail"]["data"];

    return new Promise<ResponseData>((resolve) => {
      const handler = (e: CRes[C]) => {
        if (e.detail.requestId === requestId) {
          this.cResBus.removeEventListener(responseEvent, handler);
          resolve(e.detail.data);
        }
      };

      this.cResBus.addEventListener(responseEvent, handler);
      this.dispatchTypedEvent(
        serverEvent,
        new CustomEvent(serverEvent, {
          detail: { requestId, data: data[0] },
        }) as SReq[S],
      );
    });
  };

  addReqHandler = <
    K extends keyof SReq & string,
    V extends (typeof this.sReqPair)[K],
    R extends CRes[V]["detail"]["data"],
  >(
    type: K,
    value: (payload: SReq[K]["detail"]["data"]) => R,
  ) => {
    const v = this.sReqPair[type];
    const handler = (e: SReq[K]) => {
      this.cResBus.dispatchTypedEvent(
        v,
        new CustomEvent(v, {
          detail: {
            data: value(e.detail.data),
            requestId: e.detail.requestId,
          },
        }) as CRes[V],
      );
    };
    this.addEventListener(type, handler);
    return handler;
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
  sPushBus: ServerPushBus<SPush>,
  sReqBus: ServerReqBus<SReq, CRes, ClientResBus<CRes>>,
  sResBus: ServerResBus<SRes>,
) {
  if (payload.type === "push") {
    type S = keyof SPush & string;
    const tag = payload.tag as S;
    const data = payload.data as SPush[S]["detail"];
    sPushBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as SPush[S]);
  }
  if (payload.type === "req") {
    type S = keyof SReq & string;
    const tag = payload.tag as S;
    const data = payload.data as SReq[S]["detail"];
    sReqBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as SReq[S]);
  }
  if (payload.type === "res") {
    type S = keyof SRes & string;
    const tag = payload.tag as S;
    const data = payload.data as SRes[S]["detail"];
    sResBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as SRes[S]);
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
  cPushBus: ClientPushBus<CPush>,
  cReqBus: ClientReqBus<CReq, SRes, ServerResBus<SRes>>,
  cResBus: ClientResBus<CRes>,
) {
  if (payload.type === "push") {
    type C = keyof CPush & string;
    const tag = payload.tag as C;
    const data = payload.data as CPush[C]["detail"];
    cPushBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as CPush[C]);
  }
  if (payload.type === "req") {
    type C = keyof CReq & string;
    const tag = payload.tag as C;
    const data = payload.data as CReq[C]["detail"];
    cReqBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as CReq[C]);
  }
  if (payload.type === "res") {
    type C = keyof CRes & string;
    const tag = payload.tag as C;
    const data = payload.data as CRes[C]["detail"];
    cResBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as CRes[C]);
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
  cPushPair: Record<keyof CPush & string, undefined>,
  cPushBus: ClientPushBus<CPush>,
  cReqPair: Record<keyof CReq & string, keyof SRes & string>,
  cReqBus: ClientReqBus<CReq, SRes, ServerResBus<SRes>>,
  sReqPair: Record<keyof SReq & string, keyof CRes & string>,
  cResBus: ClientResBus<CRes>,
) {
  Object.keys(cPushPair).forEach((tag: keyof CPush & string) => {
    cPushBus.addEventListener(tag, (e) => {
      const payload: WSPayload = {
        type: "push",
        tag: tag,
        data: e.detail,
      };
      ws.send(JSON.stringify(payload));
    });
  });

  Object.keys(cReqPair).forEach((tag: keyof CReq & string) => {
    cReqBus.addEventListener(tag, (e) => {
      const payload: WSPayload = {
        type: "req",
        tag: tag,
        data: e.detail,
      };
      ws.send(JSON.stringify(payload));
    });
  });

  Object.values(sReqPair).forEach((tag: keyof SReq & string) => {
    cResBus.addEventListener(tag, (e) => {
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
  sPushPair: Record<keyof SPush & string, undefined>,
  sPushBus: ServerPushBus<SPush>,
  sReqPair: Record<keyof SReq & string, keyof CRes & string>,
  sReqBus: ServerReqBus<SReq, CRes, ClientResBus<CRes>>,
  cReqPair: Record<keyof CReq & string, keyof SRes & string>,
  sResBus: ServerResBus<SRes>,
) {
  Object.keys(sReqPair).forEach((tag: keyof SReq & string) => {
    sReqBus.addEventListener(tag, (e) => {
      const payload: WSPayload = {
        type: "req",
        tag: tag,
        data: e.detail,
      };
      ws.send(JSON.stringify(payload));
    });
  });

  Object.keys(sPushPair).forEach((tag: keyof SPush & string) => {
    sPushBus.addEventListener(tag, (e) => {
      const payload: WSPayload = {
        type: "push",
        tag: tag,
        data: e.detail,
      };
      ws.send(JSON.stringify(payload));
    });
  });

  Object.values(cReqPair).forEach((tag: keyof CReq & string) => {
    sResBus.addEventListener(tag, (e) => {
      const payload: WSPayload = {
        type: "res",
        tag: tag,
        data: e.detail,
      };
      ws.send(JSON.stringify(payload));
    });
  });
}

export type CreateSchema<T extends BusSchema> = T;

type BusSchema = {
  clientPush: ClientPushEventMap;
  serverPush: ServerPushEventMap;
  clientRequest: ClientReqEventMap;
  serverRespond: ServerResEventMap;
  serverRequest: ServerReqEventMap;
  clientRespond: ClientResEventMap;
};

export function createCentralBus<Schema extends BusSchema>(contractPair: {
  clientPushPair: Record<keyof Schema["clientPush"] & string, undefined>;
  serverPushPair: Record<keyof Schema["serverPush"] & string, undefined>;
  clientRequestPair: Record<
    keyof Schema["clientRequest"] & string,
    keyof Schema["serverRespond"] & string
  >;
  serverRequestPair: Record<
    keyof Schema["serverRequest"] & string,
    keyof Schema["clientRespond"] & string
  >;
}) {
  type CPush = Schema["clientPush"];
  type SPush = Schema["serverPush"];
  type CReq = Schema["clientRequest"];
  type SRes = Schema["serverRespond"];
  type SReq = Schema["serverRequest"];
  type CRes = Schema["clientRespond"];

  const {
    clientPushPair: cPushPair,
    serverPushPair: sPushPair,
    clientRequestPair: cReqPair,
    serverRequestPair: sReqPair,
  } = contractPair;
  const cPushBus = new ClientPushBus<CPush>();
  const sPushBus = new ServerPushBus<SPush>();

  const sResBus = new ServerResBus<SRes>();
  const cReqBus = new ClientReqBus<CReq, SRes, ServerResBus<SRes>>(sResBus, cReqPair);

  const cResBus = new ClientResBus<CRes>();
  const sReqBus = new ServerReqBus<SReq, CRes, ClientResBus<CRes>>(cResBus, sReqPair);

  const onClientPayload = (payload: WSPayload) =>
    clientOnWSPayload(payload, sPushBus, sReqBus, sResBus);

  const onServerPayload = (payload: WSPayload) =>
    serverOnWSPayload(payload, cPushBus, cReqBus, cResBus);

  const setupClientWSForwarder_ = (ws: WS) =>
    setupClientWSForwarder(ws, cPushPair, cPushBus, cReqPair, cReqBus, sReqPair, cResBus);

  const setupServerWSForwarder_ = (ws: WS) =>
    setupServerWSForwarder(ws, sPushPair, sPushBus, sReqPair, sReqBus, cReqPair, sResBus);

  const clientBus = {
    push: cPushBus.push,
    addPushHandler: sPushBus.addEventListener.bind(sPushBus),
    removePushHandler: sPushBus.removeEventListener.bind(sPushBus),
    addReqHandler: sReqBus.addReqHandler,
    removeReqHandler: sReqBus.removeEventListener.bind(sReqBus),
    request: cReqBus.request,
  };

  const serverBus = {
    push: sPushBus.push,
    addPushHandler: cPushBus.addEventListener.bind(cPushBus),
    removePushHandler: cPushBus.removeEventListener.bind(cPushBus),
    addReqHandler: cReqBus.addReqHandler,
    removeReqHandler: cReqBus.removeEventListener.bind(cReqBus),
    request: sReqBus.request,
  };

  const bus = {
    client: {
      onPayload: onClientPayload,
      setupWSForwarder: setupClientWSForwarder_,
      bus: clientBus,
    },
    server: {
      onPayload: onServerPayload,
      setupWSForwarder: setupServerWSForwarder_,
      bus: serverBus,
    },
  };

  return bus;
}
