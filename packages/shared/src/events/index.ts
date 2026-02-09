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

class ClientPushBus<CPush extends ClientPushEventMap> extends TypedEventTarget<CPush> {}
class ServerPushBus<SPush extends ServerPushEventMap> extends TypedEventTarget<SPush> {}

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

export function createCentralBus<
  CPush extends ClientPushEventMap,
  SPush extends ServerPushEventMap,
  CReq extends ClientReqEventMap,
  SRes extends ServerResEventMap,
  SReq extends ServerReqEventMap,
  CRes extends ClientResEventMap,
>(
  cPushPair: Record<keyof CPush & string, undefined>,
  sPushPair: Record<keyof SPush & string, undefined>,
  cReqPair: Record<keyof CReq & string, keyof SRes & string>,
  sReqPair: Record<keyof SReq & string, keyof CRes & string>,
) {
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

  const addServerReqHandler = <
    K extends keyof CReq & string,
    V extends (typeof cReqPair)[K],
    R extends SRes[V]["detail"]["data"],
  >(
    type: K,
    value: (payload: CReq[K]["detail"]["data"]) => R,
  ) => {
    const v = cReqPair[type];
    const handler = (e: CReq[K]) => {
      sResBus.dispatchTypedEvent(
        v,
        new CustomEvent(v, {
          detail: {
            data: value(e.detail.data),
            requestId: e.detail.requestId,
          },
        }) as SRes[V],
      );
    };
    cReqBus.addEventListener(type, handler);
    return handler;
  };

  const addClientReqHandler = <
    K extends keyof SReq & string,
    V extends (typeof sReqPair)[K],
    R extends CRes[V]["detail"]["data"],
  >(
    type: K,
    value: (payload: SReq[K]["detail"]["data"]) => R,
  ) => {
    const v = sReqPair[type];
    const handler = (e: SReq[K]) => {
      cResBus.dispatchTypedEvent(
        v,
        new CustomEvent(v, {
          detail: {
            data: value(e.detail.data),
            requestId: e.detail.requestId,
          },
        }) as CRes[V],
      );
    };
    sReqBus.addEventListener(type, handler);
    return handler;
  };

  const clientBus = {
    push: cPushBus.dispatchTypedEvent.bind(cPushBus),
    addPushHandler: sPushBus.addEventListener.bind(sPushBus),
    removePushHandler: sPushBus.removeEventListener.bind(sPushBus),
    addReqHandler: addClientReqHandler,
    removeReqHandler: sReqBus.removeEventListener.bind(sReqBus),
    request: cReqBus.request,
  };

  const serverBus = {
    push: sPushBus.dispatchTypedEvent.bind(sPushBus),
    addPushHandler: cPushBus.addEventListener.bind(cPushBus),
    removePushHandler: cPushBus.removeEventListener.bind(cPushBus),
    addReqHandler: addServerReqHandler,
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
