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

export interface WithCorrelationId<T = undefined> {
  data: T;
  correlationId: string;
  ws?: WS;
}

class ResponseErrorEvent<E extends WSBusError = WSBusError> extends CustomEvent<
  WithCorrelationId<E>
> {}

type Arg<T1, T2 = undefined> = undefined extends T1
  ? undefined extends T2
    ? [data1?: T1, data2?: T2]
    : [data1: T1 | undefined, data2: T2]
  : undefined extends T2
    ? [data1: T1, data2?: T2]
    : [data1: T1, data2: T2];

type AnyPush = { payload: unknown };
type AnyRequest = { request: unknown; response: unknown };

export type Push<T = undefined> = { payload: T };
export type Request<TReq = undefined, TRes = undefined> = {
  request: TReq;
  response: TRes;
};

export type BusSchema = {
  clientPush?: Record<string, AnyPush>;
  serverPush?: Record<string, AnyPush>;
  clientRequest?: Record<string, AnyRequest>;
  serverRequest?: Record<string, AnyRequest>;
};

export interface WSPayload {
  __wsBus__: true;
  type: "push" | "req" | "res";
  tag: string;
  data: WithCorrelationId<unknown>;
}

export interface WS {
  send: (data: string) => void;
  readyState: WebSocket["readyState"];
}

type GetPayload<T> = T extends { payload: infer P } ? P : undefined;
type GetRequest<T> = T extends { request: infer Q } ? Q : undefined;
type GetResponse<T> = T extends { response: infer R } ? R : undefined;

class ClientPushBus<CPush extends Record<string, AnyPush>> extends TypedEventTarget<{
  [K in keyof CPush]: CustomEvent<WithCorrelationId<GetPayload<CPush[K]>>>;
}> {
  #events = new Set<string>();
  #ws: WS | undefined;

  linkPush = <T extends keyof CPush & string>(clientEvent: T) => {
    if (this.#events.has(clientEvent)) throw new Error(`Event ${clientEvent} is already linked`);
    this.#events.add(clientEvent);

    const push = (...data: Arg<GetPayload<CPush[T]>>) => {
      this.dispatchTypedEvent(
        clientEvent,
        new CustomEvent(clientEvent, {
          detail: { correlationId: uid(), data: data[0] as GetPayload<CPush[T]> },
        }),
      );
    };

    const handle = (handler: (payload: GetPayload<CPush[T]>) => void) => {
      const handler_ = (e: Event) => {
        handler((e as CustomEvent<WithCorrelationId>).detail.data as GetPayload<CPush[T]>);
      };
      this.addEventListener(clientEvent, handler_);
      return () => this.removeEventListener(clientEvent, handler_);
    };

    this.addEventListener(clientEvent, (e) => {
      if (this.#ws?.readyState !== WebSocket.OPEN) return;
      const payload: WSPayload = {
        __wsBus__: true,
        type: "push",
        tag: clientEvent,
        data: (e as CustomEvent<WithCorrelationId>).detail,
      };
      this.#ws.send(JSON.stringify(payload));
    });

    return [push, handle] as const;
  };

  bindWS(ws: WS) {
    this.#ws = ws;
  }
}

class ServerPushBus<SPush extends Record<string, AnyPush>> extends TypedEventTarget<{
  [K in keyof SPush]: CustomEvent<WithCorrelationId<GetPayload<SPush[K]>>>;
}> {
  #events = new Set<string>();
  #ws = new Set<WS>();

  linkPush = <T extends keyof SPush & string>(serverEvent: T) => {
    if (this.#events.has(serverEvent)) throw new Error(`Event ${serverEvent} is already linked`);
    this.#events.add(serverEvent);

    const push = (...data: Arg<GetPayload<SPush[T]>>) => {
      this.dispatchEvent(
        new CustomEvent(serverEvent, {
          detail: { correlationId: uid(), data: data[0] as GetPayload<SPush[T]> },
        }),
      );
    };

    const handle = (handler: (payload: GetPayload<SPush[T]>) => void) => {
      const handler_ = (e: Event) => {
        handler((e as CustomEvent<WithCorrelationId>).detail.data as GetPayload<SPush[T]>);
      };
      this.addEventListener(serverEvent, handler_);
      return () => this.removeEventListener(serverEvent, handler_);
    };

    this.addEventListener(serverEvent, (e) => {
      this.#ws.forEach((ws) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const payload: WSPayload = {
          __wsBus__: true,
          type: "push",
          tag: serverEvent,
          data: (e as CustomEvent<WithCorrelationId>).detail,
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

type RequestOption = { timeout?: number } | undefined;

class ServerResBus<CReq extends Record<string, AnyRequest>> extends TypedEventTarget<
  {
    [K in keyof CReq]: CustomEvent<WithCorrelationId<GetResponse<CReq[K]>>>;
  } & { __error__: ResponseErrorEvent }
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
  CReq extends Record<string, AnyRequest>,
  SResBus extends ServerResBus<CReq>,
> extends TypedEventTarget<{
  [K in keyof CReq]: CustomEvent<WithCorrelationId<GetRequest<CReq[K]>>>;
}> {
  #sResBus: SResBus;
  #ws: WS | undefined;
  #reqEvents = new Set<string>();

  constructor(sResBus: SResBus) {
    super();
    this.#sResBus = sResBus;
  }

  linkRequest = <T extends keyof CReq & string>(clientEvent: T) => {
    if (this.#reqEvents.has(clientEvent)) throw new Error(`Event ${clientEvent} is already linked`);
    this.#reqEvents.add(clientEvent);

    type ReqType = GetRequest<CReq[T]>;
    type ResType = GetResponse<CReq[T]>;

    const request = (...data: Arg<ReqType, RequestOption>): Promise<ResType> => {
      const correlationId = uid();
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutDuration = data[1]?.timeout ?? 5 * 60 * 1000;

      return new Promise((resolve, reject) => {
        const cleanup = () => {
          this.#sResBus.removeEventListener("__error__", handleError);
          this.#sResBus.removeEventListener(clientEvent, handler);
        };

        const handler = (e: Event) => {
          const detail = (e as CustomEvent<WithCorrelationId>).detail;
          if (detail.correlationId === correlationId) {
            clearTimeout(timeoutId);
            cleanup();
            resolve(detail.data as ResType);
          }
        };
        this.#sResBus.addEventListener(clientEvent, handler);

        const handleError = (e: Event) => {
          const detail = (e as ResponseErrorEvent).detail;
          if (detail.correlationId === correlationId) {
            clearTimeout(timeoutId);
            cleanup();
            reject(detail.data);
          }
        };
        this.#sResBus.addEventListener("__error__", handleError);

        timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error("Request timed out"));
        }, timeoutDuration);

        this.dispatchEvent(
          new CustomEvent(clientEvent, {
            detail: { correlationId, data: data[0] as ReqType },
          }),
        );
      });
    };

    const handle = (handler: (payload: ReqType) => ResType | Promise<ResType>) => {
      const handler_ = async (e: Event) => {
        const detail = (e as CustomEvent<WithCorrelationId>).detail;
        const result = await handler(detail.data as ReqType);
        this.#sResBus.dispatchEvent(
          new CustomEvent(clientEvent, {
            detail: { data: result, correlationId: detail.correlationId },
          }),
        );
      };
      this.addEventListener(clientEvent, handler_);
      return () => this.removeEventListener(clientEvent, handler_);
    };

    this.addEventListener(clientEvent, (e) => {
      const detail = (e as CustomEvent<WithCorrelationId>).detail;
      const payload: WSPayload = {
        __wsBus__: true,
        type: "req",
        tag: clientEvent,
        data: detail,
      };

      if (this.#ws?.readyState === WebSocket.OPEN) {
        this.#ws?.send(JSON.stringify(payload));
      } else {
        this.#sResBus.dispatchEvent(
          new ResponseErrorEvent("__error__", {
            detail: {
              data: new WSBusError("connectionClosed"),
              correlationId: detail.correlationId,
            },
          }),
        );
      }
    });

    this.#sResBus.addEventListener(clientEvent, (e) => {
      const detail = (e as CustomEvent<WithCorrelationId>).detail;
      const payload: WSPayload = {
        __wsBus__: true,
        type: "res",
        tag: clientEvent,
        data: detail,
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

class ClientResBus<SReq extends Record<string, AnyRequest>> extends TypedEventTarget<
  {
    [K in keyof SReq]: CustomEvent<WithCorrelationId<GetResponse<SReq[K]>>>;
  } & { __error__: ResponseErrorEvent }
> {
  ws: WS | undefined;
  bindWS(ws: WS) {
    this.ws = ws;
  }
}

class ServerReqBus<
  SReq extends Record<string, AnyRequest>,
  CResBus extends ClientResBus<SReq>,
> extends TypedEventTarget<{
  [K in keyof SReq]: CustomEvent<WithCorrelationId<GetRequest<SReq[K]>>>;
}> {
  #cResBus: CResBus;
  #ws = new Set<WS>();
  #reqEvents = new Set<string>();

  constructor(cResBus: CResBus) {
    super();
    this.#cResBus = cResBus;
  }

  linkRequest = <T extends keyof SReq & string>(serverEvent: T) => {
    if (this.#reqEvents.has(serverEvent)) throw new Error(`Event ${serverEvent} is already linked`);
    this.#reqEvents.add(serverEvent);

    type ReqType = GetRequest<SReq[T]>;
    type ResType = GetResponse<SReq[T]>;

    const request = (...data: Arg<ReqType, RequestOption>): Promise<ResType>[] => {
      return Array.from(this.#ws).map((ws) => {
        const correlationId = uid();
        const timeoutDuration = data[1]?.timeout ?? 5 * 60 * 1000;
        let timeoutId: ReturnType<typeof setTimeout>;

        return new Promise((resolve, reject) => {
          const cleanup = () => {
            this.#cResBus.removeEventListener("__error__", handleError);
            this.#cResBus.removeEventListener(serverEvent, handler);
          };

          const handler = (e: Event) => {
            const detail = (e as CustomEvent<WithCorrelationId>).detail;
            if (detail.correlationId === correlationId && detail.ws === ws) {
              clearTimeout(timeoutId);
              cleanup();
              resolve(detail.data as ResType);
            }
          };
          this.#cResBus.addEventListener(serverEvent, handler);

          const handleError = (e: Event) => {
            const detail = (e as ResponseErrorEvent).detail;
            if (detail.correlationId === correlationId && detail.ws === ws) {
              clearTimeout(timeoutId);
              cleanup();
              reject(detail.data);
            }
          };
          this.#cResBus.addEventListener("__error__", handleError);

          timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error("Request timed out"));
          }, timeoutDuration);

          this.dispatchEvent(
            new CustomEvent(serverEvent, {
              detail: { correlationId, data: data[0] as ReqType },
            }),
          );
        });
      });
    };

    const handle = (handler: (payload: ReqType) => ResType | Promise<ResType>) => {
      const handler_ = async (e: Event) => {
        const detail = (e as CustomEvent<WithCorrelationId>).detail;
        const result = await handler(detail.data as ReqType);
        this.#cResBus.dispatchEvent(
          new CustomEvent(serverEvent, {
            detail: { data: result, correlationId: detail.correlationId },
          }),
        );
      };
      this.addEventListener(serverEvent, handler_);
      return () => this.removeEventListener(serverEvent, handler_);
    };

    this.addEventListener(serverEvent, (e) => {
      const detail = (e as CustomEvent<WithCorrelationId>).detail;
      const payload: WSPayload = {
        __wsBus__: true,
        type: "req",
        tag: serverEvent,
        data: detail,
      };
      this.#ws.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(payload));
        } else {
          this.#cResBus.dispatchEvent(
            new ResponseErrorEvent("__error__", {
              detail: {
                data: new WSBusError("connectionClosed"),
                correlationId: detail.correlationId,
                ws,
              },
            }),
          );
        }
      });
    });

    this.#cResBus.addEventListener(serverEvent, (e) => {
      const detail = (e as CustomEvent<WithCorrelationId>).detail;
      const payload: WSPayload = {
        __wsBus__: true,
        type: "res",
        tag: serverEvent,
        data: detail,
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

export type CreateSchema<T extends BusSchema> = T;

export function createCentralBus<Schema extends BusSchema>() {
  type CPush =
    Schema["clientPush"] extends Record<string, AnyPush>
      ? Schema["clientPush"]
      : Record<string, never>;
  type SPush =
    Schema["serverPush"] extends Record<string, AnyPush>
      ? Schema["serverPush"]
      : Record<string, never>;
  type CReq =
    Schema["clientRequest"] extends Record<string, AnyRequest>
      ? Schema["clientRequest"]
      : Record<string, never>;
  type SReq =
    Schema["serverRequest"] extends Record<string, AnyRequest>
      ? Schema["serverRequest"]
      : Record<string, never>;

  const cPushBus = new ClientPushBus<CPush>();
  const sPushBus = new ServerPushBus<SPush>();

  const sResBus = new ServerResBus<CReq>();
  const cReqBus = new ClientReqBus<CReq, ServerResBus<CReq>>(sResBus);

  const cResBus = new ClientResBus<SReq>();
  const sReqBus = new ServerReqBus<SReq, ClientResBus<SReq>>(cResBus);

  function dispatch(bus: EventTarget, tag: string, data: WithCorrelationId<unknown>) {
    bus.dispatchEvent(new CustomEvent(tag, { detail: data }));
  }

  const cOnPayload = (payload: WSPayload) => {
    if (!payload?.__wsBus__) return;
    switch (payload.type) {
      case "push":
        return dispatch(sPushBus, payload.tag, payload.data);
      case "req":
        return dispatch(sReqBus, payload.tag, payload.data);
      case "res":
        return dispatch(sResBus, payload.tag, payload.data);
    }
  };

  const sOnPayload = (payload: WSPayload, ws: WS) => {
    if (!payload?.__wsBus__) return;
    payload.data.ws = ws;
    switch (payload.type) {
      case "push":
        return dispatch(cPushBus, payload.tag, payload.data);
      case "req":
        return dispatch(cReqBus, payload.tag, payload.data);
      case "res":
        return dispatch(cResBus, payload.tag, payload.data);
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
        push: cPushBus.linkPush.bind(cPushBus),
        request: cReqBus.linkRequest.bind(cReqBus),
      },
      server: {
        push: sPushBus.linkPush.bind(sPushBus),
        request: sReqBus.linkRequest.bind(sReqBus),
      },
    },
  };
}
