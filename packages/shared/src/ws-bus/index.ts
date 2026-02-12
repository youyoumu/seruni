// TODO: remove this dependency
import { TypedEventTarget } from "typescript-event-target";
import { uid } from "uid";

export interface WithReqId<T = undefined> {
  data: T;
  requestId: string;
  ws?: WS;
}

type Arg<T1, T2 = undefined> = undefined extends T1
  ? undefined extends T2
    ? [data1?: T1, data2?: T2]
    : [data1: T1 | undefined, data2: T2]
  : undefined extends T2
    ? [data1: T1, data2?: T2]
    : [data1: T1, data2: T2];

class ResponseErrorEvent<E extends Error = Error> extends CustomEvent<WithReqId<E>> {}

type ClientPushEventMap = Record<string, CustomEvent<unknown>>;
type ServerPushEventMap = Record<string, CustomEvent<unknown>>;

type ClientReqEventMap = Record<string, CustomEvent<WithReqId<unknown>>>;
type ServerResEventMap = Record<string, CustomEvent<WithReqId<unknown>>> & {
  __error__: ResponseErrorEvent;
};

type ServerReqEventMap = Record<string, CustomEvent<WithReqId<unknown>>>;
type ClientResEventMap = Record<string, CustomEvent<WithReqId<unknown>>> & {
  __error__: ResponseErrorEvent;
};

class ClientPushBus<CPush extends ClientPushEventMap> extends TypedEventTarget<CPush> {
  #events = new Set<string>();
  #ws: WS | undefined;

  #push = <T extends keyof CPush & string>(tag: T, ...payload: Arg<CPush[T]["detail"]>) => {
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
    if (this.#events.has(clientEvent)) throw new Error(`Event ${clientEvent} is already linked`);
    this.#events.add(clientEvent);

    const push = (
      ...data: undefined extends CPush[T]["detail"]
        ? [data?: CPush[T]["detail"]]
        : [data: CPush[T]["detail"]]
    ) => this.#push(clientEvent, data[0]);
    const handle = (handler: (payload: CPush[T]["detail"]) => void) =>
      this.#addPushHandler(clientEvent, handler);

    this.addEventListener(clientEvent, (e) => {
      if (this.#ws?.readyState !== WebSocket.OPEN) return;
      const payload: WSPayload = {
        type: "push",
        tag: clientEvent,
        data: e.detail as WithReqId<unknown>,
      };
      this.#ws.send(JSON.stringify(payload));
    });

    return [push, handle] as const;
  };

  bindWS(ws: WS) {
    this.#ws = ws;
  }
}
class ServerPushBus<SPush extends ServerPushEventMap> extends TypedEventTarget<SPush> {
  #events = new Set<string>();
  #ws = new Set<WS>();

  #push = <T extends keyof SPush & string>(tag: T, ...payload: Arg<SPush[T]["detail"]>) => {
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
    if (this.#events.has(serverEvent)) throw new Error(`Event ${serverEvent} is already linked`);
    this.#events.add(serverEvent);

    const push = (
      ...data: undefined extends SPush[T]["detail"]
        ? [data?: SPush[T]["detail"]]
        : [data: SPush[T]["detail"]]
    ) => this.#push(serverEvent, data[0]);
    const handle = (handler: (payload: SPush[T]["detail"]) => void) =>
      this.#addPushHandler(serverEvent, handler);

    this.addEventListener(serverEvent, (e) => {
      this.#ws.forEach((ws) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const payload: WSPayload = {
          type: "push",
          tag: serverEvent,
          data: e.detail as WithReqId<unknown>,
        };
        ws.send(JSON.stringify(payload));
      });
    });

    return [push, handle] as const;
  };

  addWS(ws: WS) {
    this.#ws.add(ws);
  }
}

type RequestOption =
  | {
      timeout?: number;
    }
  | undefined;
class ServerResBus<SRes extends ServerResEventMap> extends TypedEventTarget<
  SRes & { __error__: ResponseErrorEvent<Error> }
> {
  ws = new Set<WS>();
  addWS(ws: WS) {
    this.ws.add(ws);
  }
}
class ClientReqBus<
  CReq extends ClientReqEventMap,
  SRes extends ServerResEventMap,
  SResBus extends ServerResBus<SRes>,
> extends TypedEventTarget<CReq> {
  #sResBus: SResBus;

  #ws: WS | undefined;

  #reqEvents = new Set<string>();
  #resEvents = new Set<string>();

  constructor(sResBus: SResBus) {
    super();
    this.#sResBus = sResBus;
  }

  #request = <
    C extends keyof CReq & string,
    S extends keyof SRes & string,
    R extends SRes[S]["detail"]["data"],
  >(
    clientEvent: C,
    serverEvent: S,
    ...data: Arg<CReq[C]["detail"]["data"], RequestOption>
  ) => {
    const requestId = uid();
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutDuration = data[1]?.timeout ?? 5 * 60 * 1000;
    return new Promise<R>((resolve, reject) => {
      const cleanup = () => {
        this.#sResBus.removeEventListener("__error__", handleError);
        this.#sResBus.removeEventListener(serverEvent, handler);
      };

      const handler = (e: SRes[S]) => {
        if (e.detail.requestId === requestId) {
          clearTimeout(timeoutId);
          cleanup();
          resolve(e.detail.data as R);
        }
      };
      this.#sResBus.addEventListener(serverEvent, handler);

      const handleError = (e: ResponseErrorEvent<Error>) => {
        if (e.detail.requestId === requestId) {
          clearTimeout(timeoutId);
          cleanup();
          reject(e.detail.data);
        }
      };
      this.#sResBus.addEventListener("__error__", handleError);

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Request timed out"));
      }, timeoutDuration);

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
    S extends keyof SRes & string,
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
    C extends keyof CReq & string,
    S extends keyof SRes & string,
    R extends SRes[S]["detail"]["data"],
  >(
    clientEvent: C,
    serverEvent: S,
  ) => {
    if (this.#reqEvents.has(clientEvent)) throw new Error(`Event ${clientEvent} is already linked`);
    if (this.#resEvents.has(serverEvent)) throw new Error(`Event ${serverEvent} is already linked`);
    this.#reqEvents.add(clientEvent);
    this.#resEvents.add(serverEvent);

    const request = (...data: Arg<CReq[C]["detail"]["data"], RequestOption>) =>
      this.#request(clientEvent, serverEvent, data[0], data[1]);
    const handle = (handler: (payload: CReq[C]["detail"]["data"]) => R | Promise<R>) =>
      this.#addReqHandler(clientEvent, serverEvent, handler);

    this.addEventListener(clientEvent, (e) => {
      const payload: WSPayload = {
        type: "req",
        tag: clientEvent,
        data: e.detail,
      };

      if (this.#ws?.readyState === WebSocket.OPEN) {
        this.#ws?.send(JSON.stringify(payload));
      } else {
        this.#sResBus.dispatchTypedEvent(
          "__error__",
          new ResponseErrorEvent("__error__", {
            detail: {
              data: new Error("WebSocket is not open"),
              requestId: e.detail.requestId,
            },
          }),
        );
      }
    });

    this.#sResBus.addEventListener(serverEvent, (e) => {
      const payload: WSPayload = {
        type: "res",
        tag: serverEvent,
        data: e.detail,
      };
      this.#sResBus.ws.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
      });
    });

    return [request, handle] as const;
  };

  bindWS(ws: WS) {
    this.#ws = ws;
  }
}

class ClientResBus<CRes extends ClientResEventMap> extends TypedEventTarget<CRes> {
  ws: WS | undefined;
  bindWS(ws: WS) {
    this.ws = ws;
  }
}
class ServerReqBus<
  SReq extends ServerReqEventMap,
  CRes extends ClientResEventMap,
  CResBus extends ClientResBus<CRes>,
> extends TypedEventTarget<SReq> {
  #cResBus: CResBus;

  #ws = new Set<WS>();
  #reqEvents = new Set<string>();
  #resEvents = new Set<string>();

  constructor(cResBus: CResBus) {
    super();
    this.#cResBus = cResBus;
  }

  #request = <
    S extends keyof SReq & string,
    C extends keyof CRes & string,
    R extends CRes[C]["detail"]["data"],
  >(
    serverEvent: S,
    clientEvent: C,
    ...data: Arg<SReq[S]["detail"]["data"], RequestOption>
  ) => {
    return Array.from(this.#ws).map((ws) => {
      const requestId = uid();
      const timeoutDuration = data[1]?.timeout ?? 5 * 60 * 1000;
      let timeoutId: ReturnType<typeof setTimeout>;
      return new Promise<R>((resolve, reject) => {
        const cleanup = () => {
          this.#cResBus.removeEventListener("__error__", handleError);
          this.#cResBus.removeEventListener(clientEvent, handler);
        };
        const handler = (e: CRes[C]) => {
          if (e.detail.requestId === requestId && e.detail.ws === ws) {
            clearTimeout(timeoutId);
            cleanup();
            resolve(e.detail.data as R);
          }
        };
        this.#cResBus.addEventListener(clientEvent, handler);

        const handleError = (e: ResponseErrorEvent<Error>) => {
          if (e.detail.requestId === requestId && e.detail.ws === ws) {
            clearTimeout(timeoutId);
            cleanup();
            reject(e.detail.data);
          }
        };
        this.#cResBus.addEventListener("__error__", handleError);

        timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error("Request timed out"));
        }, timeoutDuration);

        this.dispatchTypedEvent(
          serverEvent,
          new CustomEvent(serverEvent, {
            detail: { requestId, data: data[0] },
          }) as SReq[S],
        );
      });
    });
  };

  #addReqHandler = <
    S extends keyof SReq & string,
    C extends keyof CRes & string,
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
    S extends keyof SReq & string,
    C extends keyof CRes & string,
    R extends CRes[C]["detail"]["data"],
  >(
    serverEvent: S,
    clientEvent: C,
  ) => {
    if (this.#reqEvents.has(serverEvent)) throw new Error(`Event ${serverEvent} is already linked`);
    if (this.#resEvents.has(clientEvent)) throw new Error(`Event ${clientEvent} is already linked`);
    this.#reqEvents.add(serverEvent);
    this.#resEvents.add(clientEvent);

    const request = (...data: Arg<SReq[S]["detail"]["data"], RequestOption>) =>
      this.#request(serverEvent, clientEvent, data[0], data[1]);
    const handle = (handler: (payload: SReq[S]["detail"]["data"]) => R | Promise<R>) =>
      this.#addReqHandler(serverEvent, clientEvent, handler);

    this.addEventListener(serverEvent, (e) => {
      const payload: WSPayload = {
        type: "req",
        tag: serverEvent,
        data: e.detail,
      };
      this.#ws.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
      });
    });

    this.#cResBus.addEventListener(clientEvent, (e) => {
      const payload: WSPayload = {
        type: "res",
        tag: clientEvent,
        data: e.detail,
      };
      const ws = this.#cResBus.ws;
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
    });

    return [request, handle] as const;
  };

  addWS(ws: WS) {
    this.#ws.add(ws);
  }
}

export interface WSPayload {
  type: "push" | "req" | "res";
  tag: string;
  data: WithReqId<unknown>;
}

export interface WS {
  send: (data: string) => void;
  readyState: WebSocket["readyState"];
}

export type CreateSchema<T extends BusSchema> = T;
export type PushEvent<T = undefined> = CustomEvent<T>;
export type ReqEvent<T = undefined> = CustomEvent<WithReqId<T>>;
export type ResEvent<T = undefined> = CustomEvent<WithReqId<T>>;

type BusSchema = {
  clientPush: ClientPushEventMap;
  serverPush: ServerPushEventMap;
  clientRequest: ClientReqEventMap;
  serverRespond: Omit<ServerResEventMap, "__error__">;
  serverRequest: ServerReqEventMap;
  clientRespond: Omit<ClientResEventMap, "__error__">;
};

export function createCentralBus<Schema extends BusSchema>() {
  type CPush = Schema["clientPush"];
  type SPush = Schema["serverPush"];
  type CReq = Schema["clientRequest"];
  type SRes = Schema["serverRespond"] & { __error__: ResponseErrorEvent };
  type SReq = Schema["serverRequest"];
  type CRes = Schema["clientRespond"] & { __error__: ResponseErrorEvent };

  const cPushBus = new ClientPushBus<CPush>();
  const sPushBus = new ServerPushBus<SPush>();

  const sResBus = new ServerResBus<SRes>();
  const cReqBus = new ClientReqBus<CReq, SRes, ServerResBus<SRes>>(sResBus);

  const cResBus = new ClientResBus<CRes>();
  const sReqBus = new ServerReqBus<SReq, CRes, ClientResBus<CRes>>(cResBus);

  function dispatch(bus: EventTarget, tag: string, data: WithReqId<unknown>, ws?: WS) {
    bus.dispatchEvent(
      new CustomEvent(tag, {
        detail: {
          ...data,
          ws,
        },
      }),
    );
  }

  const cOnPayload = (payload: WSPayload) => {
    switch (payload.type) {
      case "push": {
        return dispatch(sPushBus, payload.tag, payload.data);
      }
      case "req": {
        return dispatch(sReqBus, payload.tag, payload.data);
      }
      case "res": {
        return dispatch(sResBus, payload.tag, payload.data);
      }
    }
  };

  const sOnPayload = (payload: WSPayload, ws: WS) => {
    switch (payload.type) {
      case "push": {
        return dispatch(cPushBus, payload.tag, payload.data);
      }
      case "req": {
        return dispatch(cReqBus, payload.tag, payload.data);
      }
      case "res": {
        return dispatch(cResBus, payload.tag, payload.data, ws);
      }
    }
  };

  const cBindWS = (ws: WS) => {
    cPushBus.bindWS(ws);
    cResBus.bindWS(ws);
    cReqBus.bindWS(ws);
  };

  const sAddWS = (ws: WS) => {
    sPushBus.addWS(ws);
    sResBus.addWS(ws);
    sReqBus.addWS(ws);
  };

  return {
    bridge: {
      client: { bindWS: cBindWS, onPayload: cOnPayload },
      server: { addWS: sAddWS, onPayload: sOnPayload },
    },
    link: {
      client: {
        push: cPushBus.linkPush,
        request: cReqBus.linkReq,
      },
      server: {
        push: sPushBus.linkPush,
        request: sReqBus.linkReq,
      },
    },
  };
}
