// TODO: remove this dependency
import { TypedEventTarget } from "typescript-event-target";
import { uid } from "uid";

export class WSBusError extends Error {
  type: "connectionClosed" | "requestTimeout";
  constructor(type: "connectionClosed" | "requestTimeout") {
    super(type);
    this.type = type;
  }
}

export interface WithCorelationId<T = undefined> {
  data: T;
  correlationId: string;
  ws?: WS;
}

type Arg<T1, T2 = undefined> = undefined extends T1
  ? undefined extends T2
    ? [data1?: T1, data2?: T2]
    : [data1: T1 | undefined, data2: T2]
  : undefined extends T2
    ? [data1: T1, data2?: T2]
    : [data1: T1, data2: T2];

class ResponseErrorEvent<E extends WSBusError = WSBusError> extends CustomEvent<
  WithCorelationId<E>
> {}

type ClientPushEventMap = Record<string, CustomEvent<WithCorelationId<unknown>>>;
type ServerPushEventMap = Record<string, CustomEvent<WithCorelationId<unknown>>>;

type ClientReqEventMap = Record<string, CustomEvent<WithCorelationId<unknown>>>;
type ServerResEventMap = Record<string, CustomEvent<WithCorelationId<unknown>>> & {
  __error__: ResponseErrorEvent;
};

type ServerReqEventMap = Record<string, CustomEvent<WithCorelationId<unknown>>>;
type ClientResEventMap = Record<string, CustomEvent<WithCorelationId<unknown>>> & {
  __error__: ResponseErrorEvent;
};

class ClientPushBus<CPush extends ClientPushEventMap> extends TypedEventTarget<CPush> {
  #events = new Set<string>();
  #ws: WS | undefined;

  #push = <T extends keyof CPush & string>(tag: T, ...payload: Arg<CPush[T]["detail"]["data"]>) => {
    this.dispatchTypedEvent(
      tag,
      new CustomEvent(tag, {
        detail: {
          correlationId: uid(),
          data: payload[0],
        },
      }) as CPush[T],
    );
  };

  #addPushHandler = <T extends keyof CPush & string>(
    tag: T,
    handler: (data: CPush[T]["detail"]["data"]) => void,
  ) => {
    const handler_ = (e: CPush[T]) => {
      handler(e.detail.data as CPush[T]["detail"]);
    };
    this.addEventListener(tag, handler_);
    return () => this.removeEventListener(tag, handler_);
  };

  linkPush = <T extends keyof CPush & string>(clientEvent: T) => {
    if (this.#events.has(clientEvent)) throw new Error(`Event ${clientEvent} is already linked`);
    this.#events.add(clientEvent);

    const push = (...data: Arg<CPush[T]["detail"]["data"]>) => this.#push(clientEvent, ...data);
    const handle = (handler: (payload: CPush[T]["detail"]["data"]) => void) =>
      this.#addPushHandler(clientEvent, handler);

    this.addEventListener(clientEvent, (e) => {
      if (this.#ws?.readyState !== WebSocket.OPEN) return;
      const payload: WSPayload = {
        __wsBus__: true,
        type: "push",
        tag: clientEvent,
        data: e.detail,
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

  #push = <T extends keyof SPush & string>(tag: T, ...payload: Arg<SPush[T]["detail"]["data"]>) => {
    this.dispatchTypedEvent(
      tag,
      new CustomEvent(tag, {
        detail: {
          correlationId: uid(),
          data: payload[0],
        },
      }) as SPush[T],
    );
  };

  #addPushHandler = <T extends keyof SPush & string>(
    tag: T,
    handler: (data: SPush[T]["detail"]["data"]) => void,
  ) => {
    const handler_ = (e: SPush[T]) => {
      handler(e.detail.data as SPush[T]["detail"]);
    };
    this.addEventListener(tag, handler_);
    return () => this.removeEventListener(tag, handler_);
  };

  linkPush = <T extends keyof SPush & string>(serverEvent: T) => {
    if (this.#events.has(serverEvent)) throw new Error(`Event ${serverEvent} is already linked`);
    this.#events.add(serverEvent);

    const push = (...data: Arg<SPush[T]["detail"]["data"]>) => this.#push(serverEvent, ...data);
    const handle = (handler: (payload: SPush[T]["detail"]["data"]) => void) =>
      this.#addPushHandler(serverEvent, handler);

    this.addEventListener(serverEvent, (e) => {
      this.#ws.forEach((ws) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const payload: WSPayload = {
          __wsBus__: true,
          type: "push",
          tag: serverEvent,
          data: e.detail,
        };
        ws.send(JSON.stringify(payload));
      });
    });

    return [push, handle] as const;
  };

  addWS(ws: WS) {
    this.#ws.add(ws);
  }

  removeWS(ws: WS) {
    this.#ws.delete(ws);
  }
}

type RequestOption =
  | {
      timeout?: number;
    }
  | undefined;
class ServerResBus<SRes extends ServerResEventMap> extends TypedEventTarget<
  SRes & { __error__: ResponseErrorEvent }
> {
  ws = new Set<WS>();
  addWS(ws: WS) {
    this.ws.add(ws);
  }
  removeWS(ws: WS) {
    this.ws.delete(ws);
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
    const correlationId = uid();
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutDuration = data[1]?.timeout ?? 5 * 60 * 1000;
    return new Promise<R>((resolve, reject) => {
      const cleanup = () => {
        this.#sResBus.removeEventListener("__error__", handleError);
        this.#sResBus.removeEventListener(serverEvent, handler);
      };

      const handler = (e: SRes[S]) => {
        if (e.detail.correlationId === correlationId) {
          clearTimeout(timeoutId);
          cleanup();
          resolve(e.detail.data as R);
        }
      };
      this.#sResBus.addEventListener(serverEvent, handler);

      const handleError = (e: ResponseErrorEvent) => {
        if (e.detail.correlationId === correlationId) {
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
          detail: { correlationId, data: data[0] },
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
            correlationId: e.detail.correlationId,
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
        __wsBus__: true,
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
              data: new WSBusError("connectionClosed"),
              correlationId: e.detail.correlationId,
            },
          }),
        );
      }
    });

    this.#sResBus.addEventListener(serverEvent, (e) => {
      const payload: WSPayload = {
        __wsBus__: true,
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
      const correlationId = uid();
      const timeoutDuration = data[1]?.timeout ?? 5 * 60 * 1000;
      let timeoutId: ReturnType<typeof setTimeout>;
      return new Promise<R>((resolve, reject) => {
        const cleanup = () => {
          this.#cResBus.removeEventListener("__error__", handleError);
          this.#cResBus.removeEventListener(clientEvent, handler);
        };
        const handler = (e: CRes[C]) => {
          if (e.detail.correlationId === correlationId && e.detail.ws === ws) {
            clearTimeout(timeoutId);
            cleanup();
            resolve(e.detail.data as R);
          }
        };
        this.#cResBus.addEventListener(clientEvent, handler);

        const handleError = (e: ResponseErrorEvent) => {
          if (e.detail.correlationId === correlationId && e.detail.ws === ws) {
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
            detail: { correlationId, data: data[0] },
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
            correlationId: e.detail.correlationId,
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
        __wsBus__: true,
        type: "req",
        tag: serverEvent,
        data: e.detail,
      };
      this.#ws.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(payload));
        } else {
          this.#cResBus.dispatchTypedEvent(
            "__error__",
            new ResponseErrorEvent("__error__", {
              detail: {
                data: new WSBusError("connectionClosed"),
                correlationId: e.detail.correlationId,
                ws,
              },
            }),
          );
        }
      });
    });

    this.#cResBus.addEventListener(clientEvent, (e) => {
      const payload: WSPayload = {
        __wsBus__: true,
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

  removeWS(ws: WS) {
    this.#ws.delete(ws);
  }
}

export interface WSPayload {
  __wsBus__: true;
  type: "push" | "req" | "res";
  tag: string;
  data: WithCorelationId<unknown>;
}

export interface WS {
  send: (data: string) => void;
  readyState: WebSocket["readyState"];
}

export type CreateSchema<T extends BusSchema> = T;
export type PushEvent<T = undefined> = CustomEvent<WithCorelationId<T>>;
export type ReqEvent<T = undefined> = CustomEvent<WithCorelationId<T>>;
export type ResEvent<T = undefined> = CustomEvent<WithCorelationId<T>>;

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

  function dispatch(bus: EventTarget, tag: string, data: WithCorelationId<unknown>) {
    bus.dispatchEvent(new CustomEvent(tag, { detail: data }));
  }

  const cOnPayload = (payload: WSPayload) => {
    if (!payload?.__wsBus__) return;
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
    if (!payload?.__wsBus__) return;
    payload.data.ws = ws;
    switch (payload.type) {
      case "push": {
        return dispatch(cPushBus, payload.tag, payload.data);
      }
      case "req": {
        return dispatch(cReqBus, payload.tag, payload.data);
      }
      case "res": {
        return dispatch(cResBus, payload.tag, payload.data);
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

  const sRemoveWS = (ws: WS) => {
    sPushBus.removeWS(ws);
    sResBus.removeWS(ws);
    sReqBus.removeWS(ws);
  };

  return {
    bridge: {
      client: { bindWS: cBindWS, onPayload: cOnPayload },
      server: { addWS: sAddWS, removeWS: sRemoveWS, onPayload: sOnPayload },
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
