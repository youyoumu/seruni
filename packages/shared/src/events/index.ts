// TODO: remove this dependency
import { TypedEventTarget } from "typescript-event-target";
import { uid } from "uid";

interface WithReqId<T = undefined> {
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
  #push = <T extends keyof CPush & string>(
    tag: T,
    ...payload: undefined extends CPush[T]["detail"]
      ? [payload?: CPush[T]["detail"]]
      : [payload: CPush[T]["detail"]]
  ) => {
    this.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: payload[0] }) as CPush[T]);
  };

  #addPushHandler = <T extends keyof CPush & string>(
    tag: T,
    handler: (data: CPush[T]["detail"]) => void,
  ) => {
    const handler_ = (e: CPush[T]) => {
      handler(e.detail);
    };
    this.addEventListener(tag, handler_);
    return () => this.removeEventListener(tag, handler_);
  };

  linkPush = <T extends keyof CPush & string>(clientEvent: T) => {
    const push = (
      ...data: undefined extends CPush[T]["detail"]
        ? [data?: CPush[T]["detail"]]
        : [data: CPush[T]["detail"]]
    ) => this.#push(clientEvent, data[0]);
    const handle = (handler: (payload: CPush[T]["detail"]) => void) =>
      this.#addPushHandler(clientEvent, handler);
    return [push, handle] as const;
  };
}
class ServerPushBus<SPush extends ServerPushEventMap> extends TypedEventTarget<SPush> {
  #push = <T extends keyof SPush & string>(
    tag: T,
    ...payload: undefined extends SPush[T]["detail"]
      ? [payload?: SPush[T]["detail"]]
      : [payload: SPush[T]["detail"]]
  ) => {
    this.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: payload[0] }) as SPush[T]);
  };

  #addPushHandler = <T extends keyof SPush & string>(
    tag: T,
    handler: (data: SPush[T]["detail"]) => void,
  ) => {
    const handler_ = (e: SPush[T]) => {
      handler(e.detail);
    };
    this.addEventListener(tag, handler_);
    return () => this.removeEventListener(tag, handler_);
  };

  linkPush = <T extends keyof SPush & string>(serverEvent: T) => {
    const push = (
      ...data: undefined extends SPush[T]["detail"]
        ? [data?: SPush[T]["detail"]]
        : [data: SPush[T]["detail"]]
    ) => this.#push(serverEvent, data[0]);
    const handle = (handler: (payload: SPush[T]["detail"]) => void) =>
      this.#addPushHandler(serverEvent, handler);
    return [push, handle] as const;
  };
}

class ServerResBus<SRes extends ServerResEventMap> extends TypedEventTarget<SRes> {}
class ClientReqBus<
  CReq extends ClientReqEventMap,
  SRes extends ServerResEventMap,
  SResBus extends ServerResBus<SRes>,
  CReqPair extends Record<keyof CReq & string, keyof SRes & string>,
> extends TypedEventTarget<CReq> {
  #sResBus: SResBus;
  #cReqPair: CReqPair;
  constructor(sResBus: SResBus, cReqPair: CReqPair) {
    super();
    this.#sResBus = sResBus;
    this.#cReqPair = cReqPair;
  }

  #request = <
    C extends keyof CReqPair & string,
    S extends CReqPair[C],
    R extends SRes[S]["detail"]["data"],
  >(
    clientEvent: C,
    serverEvent: S,
    ...data: undefined extends CReq[C]["detail"]["data"]
      ? [data?: CReq[C]["detail"]["data"]]
      : [data: CReq[C]["detail"]["data"]]
  ) => {
    const requestId = uid();
    return new Promise<R>((resolve) => {
      const handler = (e: SRes[S]) => {
        if (e.detail.requestId === requestId) {
          this.#sResBus.removeEventListener(serverEvent, handler);
          resolve(e.detail.data as R);
        }
      };

      this.#sResBus.addEventListener(serverEvent, handler);
      this.dispatchTypedEvent(
        clientEvent,
        new CustomEvent(clientEvent, {
          detail: { requestId, data: data[0] },
        }) as CReq[C],
      );
    });
  };

  #addReqHandler = <
    C extends keyof CReq & string,
    S extends CReqPair[C],
    R extends SRes[S]["detail"]["data"],
  >(
    clientEvent: C,
    serverEvent: S,
    value: (payload: CReq[C]["detail"]["data"]) => R | Promise<R>,
  ) => {
    const handler = async (e: CReq[C]) => {
      this.#sResBus.dispatchTypedEvent(
        serverEvent,
        new CustomEvent(serverEvent, {
          detail: {
            data: await value(e.detail.data),
            requestId: e.detail.requestId,
          },
        }) as SRes[S],
      );
    };
    this.addEventListener(clientEvent, handler);
    return () => this.removeEventListener(clientEvent, handler);
  };

  linkReq = <
    C extends keyof CReqPair & string,
    S extends CReqPair[C],
    R extends SRes[S]["detail"]["data"],
  >(
    clientEvent: C,
    serverEvent: S,
  ) => {
    const request = (
      ...data: undefined extends CReq[C]["detail"]["data"]
        ? [data?: CReq[C]["detail"]["data"]]
        : [data: CReq[C]["detail"]["data"]]
    ) => this.#request(clientEvent, serverEvent, data[0]);
    const handle = (handler: (payload: CReq[C]["detail"]["data"]) => R | Promise<R>) =>
      this.#addReqHandler(clientEvent, serverEvent, handler);
    return [request, handle] as const;
  };
}

class ClientResBus<CRes extends ClientResEventMap> extends TypedEventTarget<CRes> {}
class ServerReqBus<
  SReq extends ServerReqEventMap,
  CRes extends ClientResEventMap,
  CResBus extends ClientResBus<CRes>,
  SReqPair extends Record<keyof SReq & string, keyof CRes & string>,
> extends TypedEventTarget<SReq> {
  #cResBus: CResBus;
  #sReqPair: SReqPair;
  constructor(cResBus: CResBus, sReqPair: SReqPair) {
    super();
    this.#cResBus = cResBus;
    this.#sReqPair = sReqPair;
  }

  #request = <
    S extends keyof SReqPair & string,
    C extends SReqPair[S],
    R extends CRes[C]["detail"]["data"],
  >(
    serverEvent: S,
    clientEvent: C,
    ...data: undefined extends SReq[S]["detail"]["data"]
      ? [data?: SReq[S]["detail"]["data"]]
      : [data: SReq[S]["detail"]["data"]]
  ) => {
    const requestId = uid();
    return new Promise<R>((resolve) => {
      const handler = (e: CRes[C]) => {
        if (e.detail.requestId === requestId) {
          this.#cResBus.removeEventListener(clientEvent, handler);
          resolve(e.detail.data as R);
        }
      };

      this.#cResBus.addEventListener(clientEvent, handler);
      this.dispatchTypedEvent(
        serverEvent,
        new CustomEvent(serverEvent, {
          detail: { requestId, data: data[0] },
        }) as SReq[S],
      );
    });
  };

  #addReqHandler = <
    S extends keyof SReq & string,
    C extends SReqPair[S],
    R extends CRes[C]["detail"]["data"],
  >(
    serverEvent: S,
    clientEvent: C,
    value: (payload: SReq[S]["detail"]["data"]) => R | Promise<R>,
  ) => {
    const handler = async (e: SReq[S]) => {
      this.#cResBus.dispatchTypedEvent(
        clientEvent,
        new CustomEvent(clientEvent, {
          detail: {
            data: await value(e.detail.data),
            requestId: e.detail.requestId,
          },
        }) as CRes[C],
      );
    };
    this.addEventListener(serverEvent, handler);
    return () => this.removeEventListener(serverEvent, handler);
  };

  linkReq = <
    S extends keyof SReqPair & string,
    C extends SReqPair[S],
    R extends CRes[C]["detail"]["data"],
  >(
    serverEvent: S,
    clientEvent: C,
  ) => {
    const request = (
      ...data: undefined extends SReq[S]["detail"]["data"]
        ? [data?: SReq[S]["detail"]["data"]]
        : [data: SReq[S]["detail"]["data"]]
    ) => this.#request(serverEvent, clientEvent, data[0]);
    const handle = (handler: (payload: SReq[S]["detail"]["data"]) => R | Promise<R>) =>
      this.#addReqHandler(serverEvent, clientEvent, handler);
    return [request, handle] as const;
  };
}

export interface WSPayload {
  type: "push" | "req" | "res";
  tag: string;
  data: unknown;
}

export interface WS {
  send: (data: string) => void;
  readyState: WebSocket["readyState"];
}

class ClientWSBridge<
  CPush extends ClientPushEventMap,
  SPush extends ServerPushEventMap,
  CReq extends ClientReqEventMap,
  SRes extends ServerResEventMap,
  SReq extends ServerReqEventMap,
  CRes extends ClientResEventMap,
> {
  #ws: WS | undefined;

  #cPushPair: Record<keyof CPush & string, undefined>;
  #cPushBus: ClientPushBus<CPush>;
  #cReqPair: Record<keyof CReq & string, keyof SRes & string>;
  #cReqBus: ClientReqBus<
    CReq,
    SRes,
    ServerResBus<SRes>,
    Record<keyof CReq & string, keyof SRes & string>
  >;
  #sReqPair: Record<keyof SReq & string, keyof CRes & string>;
  #cResBus: ClientResBus<CRes>;

  #sPushBus: ServerPushBus<SPush>;
  #sReqBus: ServerReqBus<
    SReq,
    CRes,
    ClientResBus<CRes>,
    Record<keyof SReq & string, keyof CRes & string>
  >;
  #sResBus: ServerResBus<SRes>;

  constructor({
    cPushPair,
    cPushBus,
    cReqPair,
    cReqBus,
    sReqPair,
    cResBus,
    sPushBus,
    sReqBus,
    sResBus,
  }: {
    cPushPair: Record<keyof CPush & string, undefined>;
    cPushBus: ClientPushBus<CPush>;
    cReqPair: Record<keyof CReq & string, keyof SRes & string>;
    cReqBus: ClientReqBus<
      CReq,
      SRes,
      ServerResBus<SRes>,
      Record<keyof CReq & string, keyof SRes & string>
    >;
    sReqPair: Record<keyof SReq & string, keyof CRes & string>;
    cResBus: ClientResBus<CRes>;
    sPushBus: ServerPushBus<SPush>;
    sReqBus: ServerReqBus<
      SReq,
      CRes,
      ClientResBus<CRes>,
      Record<keyof SReq & string, keyof CRes & string>
    >;
    sResBus: ServerResBus<SRes>;
  }) {
    this.#cPushPair = cPushPair;
    this.#cPushBus = cPushBus;
    this.#cReqPair = cReqPair;
    this.#cReqBus = cReqBus;
    this.#sReqPair = sReqPair;
    this.#cResBus = cResBus;

    this.#sPushBus = sPushBus;
    this.#sReqBus = sReqBus;
    this.#sResBus = sResBus;
  }

  setupEventListener() {
    Object.keys(this.#cPushPair).forEach((tag: keyof CPush & string) => {
      this.#cPushBus.addEventListener(tag, (e) => {
        const payload: WSPayload = {
          type: "push",
          tag: tag,
          data: e.detail,
        };
        if (this.#ws?.readyState !== WebSocket.OPEN) throw new Error("WebSocket is not open");
        this.#ws?.send(JSON.stringify(payload));
      });
    });

    Object.keys(this.#cReqPair).forEach((tag: keyof CReq & string) => {
      this.#cReqBus.addEventListener(tag, (e) => {
        const payload: WSPayload = {
          type: "req",
          tag: tag,
          data: e.detail,
        };
        if (this.#ws?.readyState !== WebSocket.OPEN) throw new Error("WebSocket is not open");
        this.#ws?.send(JSON.stringify(payload));
      });
    });

    Object.values(this.#sReqPair).forEach((tag: keyof SReq & string) => {
      this.#cResBus.addEventListener(tag, (e) => {
        const payload: WSPayload = {
          type: "res",
          tag: tag,
          data: e.detail,
        };
        if (this.#ws?.readyState !== WebSocket.OPEN) throw new Error("WebSocket is not open");
        this.#ws?.send(JSON.stringify(payload));
      });
    });
  }

  onPayload(payload: WSPayload) {
    if (payload.type === "push") {
      type S = keyof SPush & string;
      const tag = payload.tag as S;
      const data = payload.data as SPush[S]["detail"];
      this.#sPushBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as SPush[S]);
    }
    if (payload.type === "req") {
      type S = keyof SReq & string;
      const tag = payload.tag as S;
      const data = payload.data as SReq[S]["detail"];
      this.#sReqBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as SReq[S]);
    }
    if (payload.type === "res") {
      type S = keyof SRes & string;
      const tag = payload.tag as S;
      const data = payload.data as SRes[S]["detail"];
      this.#sResBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as SRes[S]);
    }
  }

  bindWS(ws: WS) {
    this.#ws = ws;
  }
}

class ServerWSBridge<
  CPush extends ClientPushEventMap,
  SPush extends ServerPushEventMap,
  CReq extends ClientReqEventMap,
  SRes extends ServerResEventMap,
  SReq extends ServerReqEventMap,
  CRes extends ClientResEventMap,
> {
  #ws = new Set<WS>();

  #sPushPair: Record<keyof SPush & string, undefined>;
  #sPushBus: ServerPushBus<SPush>;
  #sReqPair: Record<keyof SReq & string, keyof CRes & string>;
  #sReqBus: ServerReqBus<
    SReq,
    CRes,
    ClientResBus<CRes>,
    Record<keyof SReq & string, keyof CRes & string>
  >;
  #cReqPair: Record<keyof CReq & string, keyof SRes & string>;
  #sResBus: ServerResBus<SRes>;

  #cPushBus: ClientPushBus<CPush>;
  #cReqBus: ClientReqBus<
    CReq,
    SRes,
    ServerResBus<SRes>,
    Record<keyof CReq & string, keyof SRes & string>
  >;
  #cResBus: ClientResBus<CRes>;

  constructor({
    sPushPair,
    sPushBus,
    sReqPair,
    sReqBus,
    cReqPair,
    sResBus,
    cPushBus,
    cReqBus,
    cResBus,
  }: {
    sPushPair: Record<keyof SPush & string, undefined>;
    sPushBus: ServerPushBus<SPush>;
    sReqPair: Record<keyof SReq & string, keyof CRes & string>;
    sReqBus: ServerReqBus<
      SReq,
      CRes,
      ClientResBus<CRes>,
      Record<keyof SReq & string, keyof CRes & string>
    >;
    cReqPair: Record<keyof CReq & string, keyof SRes & string>;
    sResBus: ServerResBus<SRes>;
    cPushBus: ClientPushBus<CPush>;
    cReqBus: ClientReqBus<
      CReq,
      SRes,
      ServerResBus<SRes>,
      Record<keyof CReq & string, keyof SRes & string>
    >;
    cResBus: ClientResBus<CRes>;
  }) {
    this.#sPushPair = sPushPair;
    this.#sPushBus = sPushBus;
    this.#sReqPair = sReqPair;
    this.#sReqBus = sReqBus;
    this.#cReqPair = cReqPair;
    this.#sResBus = sResBus;

    this.#cPushBus = cPushBus;
    this.#cReqBus = cReqBus;
    this.#cResBus = cResBus;
  }

  setupEventListener() {
    Object.keys(this.#sReqPair).forEach((tag: keyof SReq & string) => {
      this.#sReqBus.addEventListener(tag, (e) => {
        const payload: WSPayload = {
          type: "req",
          tag: tag,
          data: e.detail,
        };
        this.#ws.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
        });
      });
    });

    Object.keys(this.#sPushPair).forEach((tag: keyof SPush & string) => {
      this.#sPushBus.addEventListener(tag, (e) => {
        const payload: WSPayload = {
          type: "push",
          tag: tag,
          data: e.detail,
        };
        this.#ws.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
        });
      });
    });

    Object.values(this.#cReqPair).forEach((tag: keyof CReq & string) => {
      this.#sResBus.addEventListener(tag, (e) => {
        const payload: WSPayload = {
          type: "res",
          tag: tag,
          data: e.detail,
        };
        this.#ws.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
        });
      });
    });
  }

  onPayload(payload: WSPayload) {
    if (payload.type === "push") {
      type C = keyof CPush & string;
      const tag = payload.tag as C;
      const data = payload.data as CPush[C]["detail"];
      this.#cPushBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as CPush[C]);
    }
    if (payload.type === "req") {
      type C = keyof CReq & string;
      const tag = payload.tag as C;
      const data = payload.data as CReq[C]["detail"];
      this.#cReqBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as CReq[C]);
    }
    if (payload.type === "res") {
      type C = keyof CRes & string;
      const tag = payload.tag as C;
      const data = payload.data as CRes[C]["detail"];
      this.#cResBus.dispatchTypedEvent(tag, new CustomEvent(tag, { detail: data }) as CRes[C]);
    }
  }

  addWS(ws: WS) {
    this.#ws.add(ws);
  }
}

export type CreateSchema<T extends BusSchema> = T;
export type PushEvent<T = undefined> = CustomEvent<T>;
export type ReqEvent<T = undefined> = CustomEvent<WithReqId<T>>;
export type ResEvent<T = undefined> = CustomEvent<WithReqId<T>>;

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
  const cReqBus = new ClientReqBus<
    CReq,
    SRes,
    ServerResBus<SRes>,
    Record<keyof CReq & string, keyof SRes & string>
  >(sResBus, cReqPair);

  const cResBus = new ClientResBus<CRes>();
  const sReqBus = new ServerReqBus<
    SReq,
    CRes,
    ClientResBus<CRes>,
    Record<keyof SReq & string, keyof CRes & string>
  >(cResBus, sReqPair);

  const clientWSBridge = new ClientWSBridge<CPush, SPush, CReq, SRes, SReq, CRes>({
    cPushPair,
    cPushBus,
    cReqPair,
    cReqBus,
    sReqPair,
    cResBus,
    sPushBus,
    sReqBus,
    sResBus,
  });
  const serverWSBridge = new ServerWSBridge<CPush, SPush, CReq, SRes, SReq, CRes>({
    sPushPair,
    sPushBus,
    sReqPair,
    sReqBus,
    cReqPair,
    sResBus,
    cPushBus,
    cReqBus,
    cResBus,
  });

  const bus = {
    clientWSBridge,
    linkClientPush: cPushBus.linkPush,
    linkClientRequest: cReqBus.linkReq,
    serverWSBridge,
    linkServerPush: sPushBus.linkPush,
    linkServerRequest: sReqBus.linkReq,
  };

  return bus;
}
