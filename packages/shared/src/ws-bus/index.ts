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

export type Push<T = undefined> = { payload: T };
export type Request<TReq = undefined, TRes = undefined> = {
  request: TReq;
  response: TRes;
};

type UnknownPush = Push<unknown>;
type UnknownRequest = Request<unknown, unknown>;

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

class ClientPushBus<CPush extends Record<string, UnknownPush>> extends EventTarget {
  #events = new Set<string>();
  #ws: WS | undefined;

  linkPush = <T extends keyof CPush & string>(clientEvent: T) => {
    if (this.#events.has(clientEvent)) throw new Error(`Event ${clientEvent} is already linked`);
    this.#events.add(clientEvent);

    /** client */
    const push = (...data: Arg<CPush[T]["payload"]>) => {
      this.dispatchEvent(
        new CustomEvent(clientEvent, {
          detail: { correlationId: uid(), data: data[0] },
        }),
      );
    };

    /** server */
    const handle = (handler: (payload: CPush[T]["payload"]) => void) => {
      const handler_ = (e: CustomEventInit<WithCorrelationId<unknown>>) => {
        handler(e.detail?.data);
      };
      this.addEventListener(clientEvent, handler_);
      return () => this.removeEventListener(clientEvent, handler_);
    };

    /** client */
    this.addEventListener(clientEvent, (e: CustomEventInit<WithCorrelationId<unknown>>) => {
      if (this.#ws?.readyState !== WebSocket.OPEN) return;
      const payload: WSPayload = {
        __wsBus__: true,
        type: "push",
        tag: clientEvent,
        data: e.detail as WithCorrelationId<unknown>,
      };
      this.#ws.send(JSON.stringify(payload));
    });

    return [push, handle] as const;
  };

  /** server */
  onPushPayload = (payload: WSPayload) => {
    this.dispatchEvent(new CustomEvent(payload.tag, { detail: payload.data }));
  };

  /** client */
  bindWS(ws: WS) {
    this.#ws = ws;
  }
}

class ServerPushBus<SPush extends Record<string, UnknownPush>> extends EventTarget {
  #events = new Set<string>();
  #ws = new Set<WS>();

  linkPush = <T extends keyof SPush & string>(serverEvent: T) => {
    if (this.#events.has(serverEvent)) throw new Error(`Event ${serverEvent} is already linked`);
    this.#events.add(serverEvent);

    /** server */
    const push = (...data: Arg<SPush[T]["payload"]>) => {
      this.dispatchEvent(
        new CustomEvent(serverEvent, {
          detail: { correlationId: uid(), data: data[0] },
        }),
      );
    };

    /** client */
    const handle = (handler: (payload: SPush[T]["payload"]) => void) => {
      const handler_ = (e: CustomEventInit<WithCorrelationId<unknown>>) => {
        handler(e.detail?.data);
      };
      this.addEventListener(serverEvent, handler_);
      return () => this.removeEventListener(serverEvent, handler_);
    };

    /** server */
    this.addEventListener(serverEvent, (e: CustomEventInit<WithCorrelationId<unknown>>) => {
      this.#ws.forEach((ws) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const payload: WSPayload = {
          __wsBus__: true,
          type: "push",
          tag: serverEvent,
          data: e.detail as WithCorrelationId<unknown>,
        };
        ws.send(JSON.stringify(payload));
      });
    });

    return [push, handle] as const;
  };

  /** client */
  onPushPayload = (payload: WSPayload) => {
    this.dispatchEvent(new CustomEvent(payload.tag, { detail: payload.data }));
  };

  /** server */
  addWS(ws: WS) {
    this.#ws.add(ws);
  }

  /** server */
  removeWS(ws: WS) {
    this.#ws.delete(ws);
  }
}

const DEFAULT_TIMEOUT = 5 * 60 * 1000;
const ERROR_EVENT = "__error__";
type RequestOption = { timeout?: number } | undefined;

class ServerResBus extends EventTarget {
  ws = new Set<WS>();

  /** client */
  onResponsePayload = (payload: WSPayload) => {
    this.dispatchEvent(new CustomEvent(payload.tag, { detail: payload.data }));
  };

  /** server */
  addWS(ws: WS) {
    this.ws.add(ws);
  }

  /** server */
  removeWS(ws: WS) {
    this.ws.delete(ws);
  }
}

class ClientReqBus<
  CReq extends Record<string, UnknownRequest>,
  SResBus extends ServerResBus,
> extends EventTarget {
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

    type ReqType = CReq[T]["request"];
    type ResType = CReq[T]["response"];

    /** client */
    const request = (...data: Arg<ReqType, RequestOption>): Promise<ResType> => {
      const correlationId = uid();
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutDuration = data[1]?.timeout ?? DEFAULT_TIMEOUT;

      return new Promise((resolve, reject) => {
        const cleanup = () => {
          this.#sResBus.removeEventListener(ERROR_EVENT, handleError);
          this.#sResBus.removeEventListener(clientEvent, handler);
        };

        const handler = (e: CustomEventInit<WithCorrelationId<unknown>>) => {
          const detail = e.detail as WithCorrelationId<unknown>;
          if (detail.correlationId === correlationId) {
            clearTimeout(timeoutId);
            cleanup();
            resolve(detail.data);
          }
        };
        this.#sResBus.addEventListener(clientEvent, handler);

        const handleError = (e: CustomEventInit<WithCorrelationId<WSBusError>>) => {
          const detail = e.detail as WithCorrelationId<WSBusError>;
          if (detail.correlationId === correlationId) {
            clearTimeout(timeoutId);
            cleanup();
            reject(detail.data);
          }
        };
        this.#sResBus.addEventListener(ERROR_EVENT, handleError);

        timeoutId = setTimeout(() => {
          cleanup();
          reject(new WSBusError("requestTimeout"));
        }, timeoutDuration);

        this.dispatchEvent(
          new CustomEvent(clientEvent, {
            detail: { correlationId, data: data[0] },
          }),
        );
      });
    };

    /** server */
    const handle = (handler: (payload: ReqType) => ResType | Promise<ResType>) => {
      const handler_ = async (e: CustomEventInit<WithCorrelationId<unknown>>) => {
        const detail = e.detail as WithCorrelationId<unknown>;
        const result = await handler(detail.data);
        this.#sResBus.dispatchEvent(
          new CustomEvent(clientEvent, {
            detail: { data: result, correlationId: detail.correlationId },
          }),
        );
      };
      this.addEventListener(clientEvent, handler_);
      return () => this.removeEventListener(clientEvent, handler_);
    };

    /** client */
    this.addEventListener(clientEvent, (e: CustomEventInit<WithCorrelationId<unknown>>) => {
      const detail = e.detail as WithCorrelationId<unknown>;
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
          new ResponseErrorEvent(ERROR_EVENT, {
            detail: {
              data: new WSBusError("connectionClosed"),
              correlationId: detail.correlationId,
            },
          }),
        );
      }
    });

    /** server */
    this.#sResBus.addEventListener(
      clientEvent,
      (e: CustomEventInit<WithCorrelationId<unknown>>) => {
        const detail = e.detail as WithCorrelationId<unknown>;
        const payload: WSPayload = {
          __wsBus__: true,
          type: "res",
          tag: clientEvent,
          data: detail,
        };
        this.#sResBus.ws.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
        });
      },
    );

    return [request, handle] as const;
  };

  /** server */
  onRequestPayload = (payload: WSPayload) => {
    this.dispatchEvent(new CustomEvent(payload.tag, { detail: payload.data }));
  };

  /** client */
  bindWS(ws: WS) {
    this.#ws = ws;
  }
}

class ClientResBus extends EventTarget {
  ws: WS | undefined;

  /** server */
  onResponsePayload = (payload: WSPayload) => {
    this.dispatchEvent(new CustomEvent(payload.tag, { detail: payload.data }));
  };

  /** client */
  bindWS(ws: WS) {
    this.ws = ws;
  }
}

class ServerReqBus<
  SReq extends Record<string, UnknownRequest>,
  CResBus extends ClientResBus,
> extends EventTarget {
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

    type ReqType = SReq[T]["request"];
    type ResType = SReq[T]["response"];

    /** server */
    const request = (...data: Arg<ReqType, RequestOption>): Promise<ResType>[] => {
      return Array.from(this.#ws).map((ws) => {
        const correlationId = uid();
        const timeoutDuration = data[1]?.timeout ?? 5 * 60 * 1000;
        let timeoutId: ReturnType<typeof setTimeout>;

        return new Promise((resolve, reject) => {
          const cleanup = () => {
            this.#cResBus.removeEventListener(ERROR_EVENT, handleError);
            this.#cResBus.removeEventListener(serverEvent, handler);
          };

          const handler = (e: CustomEventInit<WithCorrelationId<unknown>>) => {
            const detail = e.detail as WithCorrelationId<unknown>;
            if (detail.correlationId === correlationId && detail.ws === ws) {
              clearTimeout(timeoutId);
              cleanup();
              resolve(detail.data);
            }
          };
          this.#cResBus.addEventListener(serverEvent, handler);

          const handleError = (e: CustomEventInit<WithCorrelationId<WSBusError>>) => {
            const detail = e.detail as WithCorrelationId<WSBusError>;
            if (detail.correlationId === correlationId && detail.ws === ws) {
              clearTimeout(timeoutId);
              cleanup();
              reject(detail.data);
            }
          };
          this.#cResBus.addEventListener(ERROR_EVENT, handleError);

          timeoutId = setTimeout(() => {
            cleanup();
            reject(new WSBusError("requestTimeout"));
          }, timeoutDuration);

          this.dispatchEvent(
            new CustomEvent(serverEvent, {
              detail: { correlationId, data: data[0] },
            }),
          );
        });
      });
    };

    /** client */
    const handle = (handler: (payload: ReqType) => ResType | Promise<ResType>) => {
      const handler_ = async (e: CustomEventInit) => {
        const detail = e.detail;
        const result = await handler(detail.data);
        this.#cResBus.dispatchEvent(
          new CustomEvent(serverEvent, {
            detail: { data: result, correlationId: detail.correlationId },
          }),
        );
      };
      this.addEventListener(serverEvent, handler_);
      return () => this.removeEventListener(serverEvent, handler_);
    };

    /** server */
    this.addEventListener(serverEvent, (e: CustomEventInit<WithCorrelationId<unknown>>) => {
      const detail = e.detail as WithCorrelationId<unknown>;
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
            new ResponseErrorEvent(ERROR_EVENT, {
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

    /** client */
    this.#cResBus.addEventListener(
      serverEvent,
      (e: CustomEventInit<WithCorrelationId<unknown>>) => {
        const detail = e.detail as WithCorrelationId<unknown>;
        const payload: WSPayload = {
          __wsBus__: true,
          type: "res",
          tag: serverEvent,
          data: detail,
        };
        const ws = this.#cResBus.ws;
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
      },
    );

    return [request, handle] as const;
  };

  /** client */
  onRequestPayload = (payload: WSPayload) => {
    this.dispatchEvent(new CustomEvent(payload.tag, { detail: payload.data }));
  };

  /** server */
  addWS(ws: WS) {
    this.#ws.add(ws);
  }

  /** server */
  removeWS(ws: WS) {
    this.#ws.delete(ws);
  }
}

export type BusSchema = {
  clientPush?: Record<string, UnknownPush>;
  serverPush?: Record<string, UnknownPush>;
  clientRequest?: Record<string, UnknownRequest>;
  serverRequest?: Record<string, UnknownRequest>;
};
export type CreateSchema<T extends BusSchema> = T;

export function createCentralBus<Schema extends BusSchema>() {
  type CPush =
    Schema["clientPush"] extends Record<string, UnknownPush>
      ? Schema["clientPush"]
      : Record<string, never>;
  type SPush =
    Schema["serverPush"] extends Record<string, UnknownPush>
      ? Schema["serverPush"]
      : Record<string, never>;
  type CReq =
    Schema["clientRequest"] extends Record<string, UnknownRequest>
      ? Schema["clientRequest"]
      : Record<string, never>;
  type SReq =
    Schema["serverRequest"] extends Record<string, UnknownRequest>
      ? Schema["serverRequest"]
      : Record<string, never>;

  const cPushBus = new ClientPushBus<CPush>();
  const sPushBus = new ServerPushBus<SPush>();

  const sResBus = new ServerResBus();
  const cReqBus = new ClientReqBus<CReq, ServerResBus>(sResBus);

  const cResBus = new ClientResBus();
  const sReqBus = new ServerReqBus<SReq, ClientResBus>(cResBus);

  const cOnPayload = (payload: WSPayload) => {
    if (!payload?.__wsBus__) return;
    switch (payload.type) {
      case "push":
        return sPushBus.onPushPayload(payload);
      case "req":
        return sReqBus.onRequestPayload(payload);
      case "res":
        return sResBus.onResponsePayload(payload);
    }
  };

  //TODO: move to method
  const sOnPayload = (payload: WSPayload, ws: WS) => {
    if (!payload?.__wsBus__) return;
    payload.data.ws = ws;
    switch (payload.type) {
      case "push":
        return cPushBus.onPushPayload(payload);
      case "req":
        return cReqBus.onRequestPayload(payload);
      case "res":
        return cResBus.onResponsePayload(payload);
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
