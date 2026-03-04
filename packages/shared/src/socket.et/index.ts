import { type StandardSchemaV1 } from "@standard-schema/spec";
import { uid } from "uid";

type StandardSchema = StandardSchemaV1;
type InferOutput<Schema extends StandardSchema> = StandardSchemaV1.InferOutput<Schema>;
type Arg<T1, T2 = undefined> = undefined extends T1
  ? undefined extends T2
    ? [arg1?: T1, arg2?: T2]
    : [arg1: T1 | undefined, arg2: T2]
  : undefined extends T2
    ? [arg1: T1, arg2?: T2]
    : [arg1: T1, arg2: T2];

type SocketErrorType = typeof SocketError.ConnectionClosed | typeof SocketError.RequestTimeout;

class SocketError extends Error {
  static ConnectionClosed = 0 as const;
  static RequestTimeout = 1 as const;
  constructor(public readonly type: SocketErrorType) {
    super();
    this.name = "SocketError";
  }
}

class SocketEnvelope<T extends unknown = unknown> {
  constructor(
    public data: T,
    public correlationId: string,
    public ws?: WS,
  ) {}
}

class SocketEvent<T extends SocketEnvelope> extends Event {
  constructor(
    public type: string,
    public envelope: T,
  ) {
    super(type);
  }
}

class SocketErrorEvent<E extends SocketError> extends SocketEvent<SocketEnvelope<E>> {
  static EVENT_NAME = "__error__";
  constructor(envelope: SocketEnvelope<E>) {
    super(SocketErrorEvent.EVENT_NAME, envelope);
  }
}

type Push<T = undefined> = { payload: T };
type ReqRes<TReq = undefined, TRes = undefined> = {
  request: TReq;
  response: TRes;
};

type UnknownPush = Push<unknown>;
type UnknownReqRes = ReqRes<unknown, unknown>;

interface PushSchema<T extends StandardSchema = StandardSchema> {
  type: "push";
  schema: T;
}
interface ReqResSchema<
  TReq extends StandardSchema = StandardSchema,
  TRes extends StandardSchema = StandardSchema,
> {
  type: "reqres";
  requestSchema: TReq;
  responseSchema: TRes;
}

function push<T extends StandardSchema = StandardSchema>(schema: T): PushSchema<T> {
  return { type: "push", schema };
}

function request<TReq extends StandardSchema, TRes extends StandardSchema>(
  requestSchema: TReq,
  responseSchema: TRes,
): ReqResSchema<TReq, TRes> {
  return {
    type: "reqres",
    requestSchema,
    responseSchema,
  };
}

interface SocketPacket {
  __wsBus__: true;
  type: "push" | "req" | "res";
  tag: string;
  envelope: SocketEnvelope<unknown>;
}

interface WS {
  send: (data: string) => void;
  readyState: WebSocket["readyState"];
}

class ClientWS {
  ws: WS | undefined;
  bindWS(ws: WS) {
    this.ws = ws;
  }
}

class ServerWS {
  ws = new Set<WS>();
  addWS(ws: WS) {
    this.ws.add(ws);
  }
  removeWS(ws: WS) {
    this.ws.delete(ws);
  }
}

class ClientPushBus<CPush extends Record<string, UnknownPush>> extends EventTarget {
  #events = new Set<string>();
  #clientWS: ClientWS;

  constructor(clientWS: ClientWS) {
    super();
    this.#clientWS = clientWS;
  }

  linkPush<T extends keyof CPush & string>(clientEvent: T) {
    if (this.#events.has(clientEvent)) throw new Error(`Event ${clientEvent} is already linked`);
    this.#events.add(clientEvent);

    /** used on client: to push data to server */
    const push = (...data: Arg<CPush[T]["payload"]>) => {
      /** [1] */
      this.dispatchEvent(new SocketEvent(clientEvent, new SocketEnvelope(data[0], uid())));
    };

    /** used on server: to handle data from client */
    const handle = (handler: (payload: CPush[T]["payload"]) => void) => {
      const handler_ = (e: Event) => {
        if (!(e instanceof SocketEvent)) return;
        handler(e.envelope.data);
      };
      /** [2] */
      this.addEventListener(clientEvent, handler_);
      return () => this.removeEventListener(clientEvent, handler_);
    };

    /** [1] */
    /** used on client: to forward events to server through WebSocket */
    this.addEventListener(clientEvent, (e: Event) => {
      if (!(e instanceof SocketEvent)) return;
      if (this.#clientWS.ws?.readyState !== WebSocket.OPEN) return;
      const payload: SocketPacket = {
        __wsBus__: true,
        type: "push",
        tag: clientEvent,
        envelope: e.envelope,
      };
      this.#clientWS.ws.send(JSON.stringify(payload));
    });

    return { push, handle };
  }

  /** used on server: to forward data from WebSocket through events */
  onPushPayload(payload: SocketPacket) {
    /** [2] */
    this.dispatchEvent(new SocketEvent(payload.tag, payload.envelope));
  }

  setup(clientPush: (keyof CPush & string)[]) {
    type ClientPush = { [K in keyof CPush]: (...data: Arg<CPush[K]["payload"]>) => void };
    type ServerHandlePush = {
      [K in keyof CPush]: (handler: (payload: CPush[K]["payload"]) => void) => () => void;
    };

    const result: {
      client: { push: Record<string, unknown> };
      server: { onPush: Record<string, unknown> };
    } = {
      client: { push: {} },
      server: { onPush: {} },
    };

    clientPush.forEach((key) => {
      const api = this.linkPush(key);
      result.client.push[key] = api.push;
      result.server.onPush[key] = api.handle;
    });

    return result as {
      client: { push: ClientPush };
      server: { onPush: ServerHandlePush };
    };
  }
}

class ServerPushBus<SPush extends Record<string, UnknownPush>> extends EventTarget {
  #events = new Set<string>();
  #serverWS: ServerWS;

  constructor(serverWS: ServerWS) {
    super();
    this.#serverWS = serverWS;
  }

  linkPush<T extends keyof SPush & string>(serverEvent: T) {
    if (this.#events.has(serverEvent)) throw new Error(`Event ${serverEvent} is already linked`);
    this.#events.add(serverEvent);

    /** used on server: to push data to all connected clients */
    const push = (...data: Arg<SPush[T]["payload"]>) => {
      /** [3] */
      this.dispatchEvent(new SocketEvent(serverEvent, new SocketEnvelope(data[0], uid())));
    };

    /** used on client: to handle data from server */
    const handle = (handler: (payload: SPush[T]["payload"]) => void) => {
      const handler_ = (e: Event) => {
        if (!(e instanceof SocketEvent)) return;
        handler(e.envelope.data);
      };
      /** [4] */
      this.addEventListener(serverEvent, handler_);
      return () => this.removeEventListener(serverEvent, handler_);
    };

    /** [3] */
    /** used on server: to forward events to all connected clients through WebSocket */
    this.addEventListener(serverEvent, (e: Event) => {
      if (!(e instanceof SocketEvent)) return;
      this.#serverWS.ws.forEach((ws) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const payload: SocketPacket = {
          __wsBus__: true,
          type: "push",
          tag: serverEvent,
          envelope: e.envelope,
        };
        ws.send(JSON.stringify(payload));
      });
    });

    return { push, handle };
  }

  /** used on client: to forward data from WebSocket through events */
  onPushPayload(payload: SocketPacket) {
    /** [4] */
    this.dispatchEvent(new SocketEvent(payload.tag, payload.envelope));
  }

  setup(serverPush: (keyof SPush & string)[]) {
    type ClientHandlePush = {
      [K in keyof SPush]: (handler: (payload: SPush[K]["payload"]) => void) => () => void;
    };
    type ServerPush = { [K in keyof SPush]: (...data: Arg<SPush[K]["payload"]>) => void };

    const result: {
      client: { onPush: Record<string, unknown> };
      server: { push: Record<string, unknown> };
    } = {
      client: { onPush: {} },
      server: { push: {} },
    };

    serverPush.forEach((key) => {
      const api = this.linkPush(key);
      result.client.onPush[key] = api.handle;
      result.server.push[key] = api.push;
    });

    return result as {
      client: { onPush: ClientHandlePush };
      server: { push: ServerPush };
    };
  }
}

const DEFAULT_TIMEOUT = 5 * 60 * 1000;
type RequestOption = { timeout?: number } | undefined;

class ServerResBus extends EventTarget {
  /** used on client: to forward response data from WebSocket through events */
  onResponsePayload(payload: SocketPacket) {
    /** [7] */
    this.dispatchEvent(new SocketEvent(payload.tag, payload.envelope));
  }
}

class ClientReqBus<
  CReq extends Record<string, UnknownReqRes>,
  SResBus extends ServerResBus,
> extends EventTarget {
  #sResBus: SResBus;
  #clientWS: ClientWS;
  #serverWS: ServerWS;
  #reqEvents = new Set<string>();

  constructor(sResBus: SResBus, clientWS: ClientWS, serverWS: ServerWS) {
    super();
    this.#sResBus = sResBus;
    this.#clientWS = clientWS;
    this.#serverWS = serverWS;
  }

  linkRequest<T extends keyof CReq & string>(clientEvent: T) {
    if (this.#reqEvents.has(clientEvent)) throw new Error(`Event ${clientEvent} is already linked`);
    this.#reqEvents.add(clientEvent);

    type ReqType = CReq[T]["request"];
    type ResType = CReq[T]["response"];

    /** used on client: to send a request to server and receive response */
    const request = (...data: Arg<ReqType, RequestOption>): Promise<ResType> => {
      const correlationId = uid();
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutDuration = data[1]?.timeout ?? DEFAULT_TIMEOUT;

      return new Promise((resolve, reject) => {
        const cleanup = () => {
          this.#sResBus.removeEventListener(SocketErrorEvent.EVENT_NAME, handleError);
          this.#sResBus.removeEventListener(clientEvent, handler);
        };

        const handler = (e: Event) => {
          if (!(e instanceof SocketEvent)) return;
          if (e.envelope.correlationId === correlationId) {
            clearTimeout(timeoutId);
            cleanup();
            resolve(e.envelope.data);
          }
        };
        /** [7] */
        this.#sResBus.addEventListener(clientEvent, handler);

        const handleError = (e: Event) => {
          if (!(e instanceof SocketErrorEvent)) return;
          if (e.envelope.correlationId === correlationId) {
            clearTimeout(timeoutId);
            cleanup();
            reject(e.envelope.data);
          }
        };
        /** [7] */
        this.#sResBus.addEventListener(SocketErrorEvent.EVENT_NAME, handleError);

        timeoutId = setTimeout(() => {
          cleanup();
          reject(new SocketError(SocketError.RequestTimeout));
        }, timeoutDuration);

        /** [5] */
        this.dispatchEvent(
          new SocketEvent(clientEvent, new SocketEnvelope(data[0], correlationId)),
        );
      });
    };

    /** used on server: to handle request from client and return response */
    const handle = (handler: (payload: ReqType) => ResType | Promise<ResType>) => {
      const handler_ = async (e: Event) => {
        if (!(e instanceof SocketEvent)) return;
        const result = await handler(e.envelope.data);
        /** [7] */
        this.#sResBus.dispatchEvent(
          new SocketEvent(clientEvent, new SocketEnvelope(result, e.envelope.correlationId)),
        );
      };
      /** [6] */
      this.addEventListener(clientEvent, handler_);
      return () => this.removeEventListener(clientEvent, handler_);
    };

    /** [5] */
    /** used on client: to forward request to server through WebSocket */
    this.addEventListener(clientEvent, (e: Event) => {
      if (!(e instanceof SocketEvent)) return;
      const payload: SocketPacket = {
        __wsBus__: true,
        type: "req",
        tag: clientEvent,
        envelope: e.envelope,
      };

      if (this.#clientWS.ws?.readyState === WebSocket.OPEN) {
        this.#clientWS.ws?.send(JSON.stringify(payload));
      } else {
        /** [7] */
        this.#sResBus.dispatchEvent(
          new SocketErrorEvent(
            new SocketEnvelope(
              new SocketError(SocketError.ConnectionClosed),
              e.envelope.correlationId,
            ),
          ),
        );
      }
    });

    /** [7] */
    /** used on server: to forward response to client through WebSocket */
    this.#sResBus.addEventListener(clientEvent, (e: Event) => {
      if (!(e instanceof SocketEvent)) return;
      const payload: SocketPacket = {
        __wsBus__: true,
        type: "res",
        tag: clientEvent,
        envelope: e.envelope,
      };
      this.#serverWS.ws.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
      });
    });

    return { request, handle };
  }

  /** used on server: to forward request data from WebSocket through events */
  onRequestPayload(payload: SocketPacket) {
    /** [6] */
    this.dispatchEvent(new SocketEvent(payload.tag, payload.envelope));
  }

  setup(clientRequest: (keyof CReq & string)[]) {
    type ClientRequest = {
      [K in keyof CReq]: (
        ...data: Arg<CReq[K]["request"], RequestOption>
      ) => Promise<CReq[K]["response"]>;
    };
    type ServerHandleRequest = {
      [K in keyof CReq]: (
        handler: (
          payload: CReq[K]["request"],
        ) => CReq[K]["response"] | Promise<CReq[K]["response"]>,
      ) => () => void;
    };

    const result: {
      client: { request: Record<string, unknown> };
      server: { onRequest: Record<string, unknown> };
    } = {
      client: { request: {} },
      server: { onRequest: {} },
    };

    clientRequest.forEach((key) => {
      const api = this.linkRequest(key);
      result.client.request[key] = api.request;
      result.server.onRequest[key] = api.handle;
    });

    return result as {
      client: { request: ClientRequest };
      server: { onRequest: ServerHandleRequest };
    };
  }
}

class ClientResBus extends EventTarget {
  /** used on server: to forward response data from WebSocket through events */
  onResponsePayload(payload: SocketPacket) {
    /** [10] */
    this.dispatchEvent(new SocketEvent(payload.tag, payload.envelope));
  }
}

class ServerReqBus<
  SReq extends Record<string, UnknownReqRes>,
  CResBus extends ClientResBus,
> extends EventTarget {
  #cResBus: CResBus;
  #serverWS: ServerWS;
  #clientWS: ClientWS;
  #reqEvents = new Set<string>();

  constructor(cResBus: CResBus, serverWS: ServerWS, clientWS: ClientWS) {
    super();
    this.#cResBus = cResBus;
    this.#serverWS = serverWS;
    this.#clientWS = clientWS;
  }

  linkRequest<T extends keyof SReq & string>(serverEvent: T) {
    if (this.#reqEvents.has(serverEvent)) throw new Error(`Event ${serverEvent} is already linked`);
    this.#reqEvents.add(serverEvent);

    type ReqType = SReq[T]["request"];
    type ResType = SReq[T]["response"];

    /** used on server: to send a request to all connected clients and receive responses */
    const request = (...data: Arg<ReqType, RequestOption>): Promise<ResType>[] => {
      return Array.from(this.#serverWS.ws).map((ws) => {
        const correlationId = uid();
        const timeoutDuration = data[1]?.timeout ?? 5 * 60 * 1000;
        let timeoutId: ReturnType<typeof setTimeout>;

        return new Promise((resolve, reject) => {
          const cleanup = () => {
            this.#cResBus.removeEventListener(SocketErrorEvent.EVENT_NAME, handleError);
            this.#cResBus.removeEventListener(serverEvent, handler);
          };

          const handler = (e: Event) => {
            if (!(e instanceof SocketEvent)) return;
            if (e.envelope.correlationId === correlationId && e.envelope.ws === ws) {
              clearTimeout(timeoutId);
              cleanup();
              resolve(e.envelope.data);
            }
          };
          /** [10] */
          this.#cResBus.addEventListener(serverEvent, handler);

          const handleError = (e: Event) => {
            if (!(e instanceof SocketErrorEvent)) return;
            if (e.envelope.correlationId === correlationId && e.envelope.ws === ws) {
              clearTimeout(timeoutId);
              cleanup();
              reject(e.envelope.data);
            }
          };
          /** [10] */
          this.#cResBus.addEventListener(SocketErrorEvent.EVENT_NAME, handleError);

          timeoutId = setTimeout(() => {
            cleanup();
            reject(new SocketError(SocketError.RequestTimeout));
          }, timeoutDuration);

          /** [8] */
          this.dispatchEvent(
            new SocketEvent(serverEvent, new SocketEnvelope(data[0], correlationId)),
          );
        });
      });
    };

    /** used on client**: to handle request from server and return response */
    const handle = (handler: (payload: ReqType) => ResType | Promise<ResType>) => {
      const handler_ = async (e: Event) => {
        if (!(e instanceof SocketEvent)) return;
        const result = await handler(e.envelope.data);
        /** [10] */
        this.#cResBus.dispatchEvent(
          new SocketEvent(serverEvent, new SocketEnvelope(result, e.envelope.correlationId)),
        );
      };
      /** [9] */
      this.addEventListener(serverEvent, handler_);
      return () => this.removeEventListener(serverEvent, handler_);
    };

    /** [8] */
    /** used on server: to forward request to all connected clients through WebSocket */
    this.addEventListener(serverEvent, (e: Event) => {
      if (!(e instanceof SocketEvent)) return;
      const payload: SocketPacket = {
        __wsBus__: true,
        type: "req",
        tag: serverEvent,
        envelope: e.envelope,
      };
      this.#serverWS.ws.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(payload));
        } else {
          /** [10] */
          this.#cResBus.dispatchEvent(
            new SocketErrorEvent(
              new SocketEnvelope(
                new SocketError(SocketError.ConnectionClosed),
                e.envelope.correlationId,
                ws,
              ),
            ),
          );
        }
      });
    });

    /** [10] */
    /** used on client**: to forward response to server through WebSocket */
    this.#cResBus.addEventListener(serverEvent, (e: Event) => {
      if (!(e instanceof SocketEvent)) return;
      const payload: SocketPacket = {
        __wsBus__: true,
        type: "res",
        tag: serverEvent,
        envelope: e.envelope,
      };
      const ws = this.#clientWS.ws;
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
    });

    return { request, handle };
  }

  /** used on client: to forward request data from WebSocket through events */
  onRequestPayload(payload: SocketPacket) {
    /** [9] */
    this.dispatchEvent(new SocketEvent(payload.tag, payload.envelope));
  }

  setup(serverRequest: (keyof SReq & string)[]) {
    type ServerRequest = {
      [K in keyof SReq]: (
        ...data: Arg<SReq[K]["request"], RequestOption>
      ) => Promise<SReq[K]["response"]>[];
    };
    type ClientHandleRequest = {
      [K in keyof SReq]: (
        handler: (
          payload: SReq[K]["request"],
        ) => SReq[K]["response"] | Promise<SReq[K]["response"]>,
      ) => () => void;
    };

    const result: {
      client: { onRequest: Record<string, unknown> };
      server: { request: Record<string, unknown> };
    } = {
      client: { onRequest: {} },
      server: { request: {} },
    };

    serverRequest.forEach((key) => {
      const api = this.linkRequest(key);
      result.client.onRequest[key] = api.handle;
      result.server.request[key] = api.request;
    });

    return result as {
      client: { onRequest: ClientHandleRequest };
      server: { request: ServerRequest };
    };
  }
}

type BusSchema = {
  clientPush?: Record<string, UnknownPush>;
  serverPush?: Record<string, UnknownPush>;
  clientRequest?: Record<string, UnknownReqRes>;
  serverRequest?: Record<string, UnknownReqRes>;
};
type CreateSchema<T extends BusSchema> = T;

type PushSchemas<T extends Record<string, PushSchema>> = {
  [K in keyof T]: T[K] extends PushSchema<infer S> ? Push<InferOutput<S>> : never;
};
type RequestSchemas<T extends Record<string, ReqResSchema>> = {
  [K in keyof T]: T[K] extends ReqResSchema<infer Req, infer Res>
    ? ReqRes<InferOutput<Req>, InferOutput<Res>>
    : never;
};

type SocketSchemas = {
  clientPush?: Record<string, PushSchema>;
  serverPush?: Record<string, PushSchema>;
  clientRequest?: Record<string, ReqResSchema>;
  serverRequest?: Record<string, ReqResSchema>;
};

function createSchema<const T extends SocketSchemas>(schemas: T): T {
  return schemas;
}

function createCentralBus<const Schema extends SocketSchemas>(schemas: Schema) {
  type CPush = PushSchemas<NonNullable<Schema["clientPush"]>>;
  type SPush = PushSchemas<NonNullable<Schema["serverPush"]>>;
  type CReq = RequestSchemas<NonNullable<Schema["clientRequest"]>>;
  type SReq = RequestSchemas<NonNullable<Schema["serverRequest"]>>;

  const clientWS = new ClientWS();
  const serverWS = new ServerWS();

  const cPushBus = new ClientPushBus<CPush>(clientWS);
  const sPushBus = new ServerPushBus<SPush>(serverWS);

  const sResBus = new ServerResBus();
  const cReqBus = new ClientReqBus<CReq, ServerResBus>(sResBus, clientWS, serverWS);

  const cResBus = new ClientResBus();
  const sReqBus = new ServerReqBus<SReq, ClientResBus>(cResBus, serverWS, clientWS);

  const validatePush = async (
    tag: string,
    data: unknown,
    pushSchemas: Schema["clientPush"] | Schema["serverPush"],
  ) => {
    const schema = pushSchemas?.[tag];
    if (!schema || schema.type !== "push") return data;
    const result = await schema.schema["~standard"].validate(data);
    if ("issues" in result) {
      console.error(`Validation failed for push [${tag}]:`, result.issues);
      return new Error(`Validation failed for push [${tag}]`, { cause: result.issues });
    }
    return result.value;
  };

  const validateRequest = async (
    tag: string,
    data: unknown,
    reqSchemas: Schema["clientRequest"] | Schema["serverRequest"],
    isResponse: boolean,
  ) => {
    const schema = reqSchemas?.[tag];
    if (!schema || schema.type !== "reqres") return data;
    const schemaToUse = isResponse ? schema.responseSchema : schema.requestSchema;
    const result = await schemaToUse["~standard"].validate(data);
    if ("issues" in result) {
      console.error(
        `Validation failed for ${isResponse ? "response" : "request"} [${tag}]:`,
        result.issues,
      );
      return new Error(`Validation failed for ${isResponse ? "response" : "request"} [${tag}]`, {
        cause: result.issues,
      });
    }
    return result.value;
  };

  const cOnPayload = async (payload: SocketPacket) => {
    if (!payload?.__wsBus__) return;
    switch (payload.type) {
      case "push":
        payload.envelope.data = await validatePush(
          payload.tag,
          payload.envelope.data,
          schemas.serverPush,
        );
        if (payload.envelope.data instanceof Error) return;
        return sPushBus.onPushPayload(payload);
      case "req":
        payload.envelope.data = await validateRequest(
          payload.tag,
          payload.envelope.data,
          schemas.serverRequest,
          false,
        );
        if (payload.envelope.data instanceof Error) return;
        return sReqBus.onRequestPayload(payload);
      case "res":
        payload.envelope.data = await validateRequest(
          payload.tag,
          payload.envelope.data,
          schemas.clientRequest,
          true,
        );
        if (payload.envelope.data instanceof Error) return;
        return sResBus.onResponsePayload(payload);
    }
  };

  const sOnPayload = async (payload: SocketPacket, ws: WS) => {
    if (!payload?.__wsBus__) return;
    payload.envelope.ws = ws;
    switch (payload.type) {
      case "push":
        payload.envelope.data = await validatePush(
          payload.tag,
          payload.envelope.data,
          schemas.clientPush,
        );
        if (payload.envelope.data instanceof Error) return;
        return cPushBus.onPushPayload(payload);
      case "req":
        payload.envelope.data = await validateRequest(
          payload.tag,
          payload.envelope.data,
          schemas.clientRequest,
          false,
        );
        if (payload.envelope.data instanceof Error) return;
        return cReqBus.onRequestPayload(payload);
      case "res":
        payload.envelope.data = await validateRequest(
          payload.tag,
          payload.envelope.data,
          schemas.serverRequest,
          true,
        );
        if (payload.envelope.data instanceof Error) return;
        return cResBus.onResponsePayload(payload);
    }
  };

  const clientPushApi = cPushBus.setup(Object.keys(schemas.clientPush ?? {}));
  const clientRequestApi = cReqBus.setup(Object.keys(schemas.clientRequest ?? {}));
  const serverPushApi = sPushBus.setup(Object.keys(schemas.serverPush ?? {}));
  const serverRequestApi = sReqBus.setup(Object.keys(schemas.serverRequest ?? {}));

  return {
    client: {
      onPayload: cOnPayload,
      bindWS: clientWS.bindWS.bind(clientWS),
      api: {
        push: clientPushApi.client.push,
        request: clientRequestApi.client.request,
        onPush: serverPushApi.client.onPush,
        onRequest: serverRequestApi.client.onRequest,
      },
    },
    server: {
      onPayload: sOnPayload,
      addWS: serverWS.addWS.bind(serverWS),
      removeWS: serverWS.removeWS.bind(serverWS),
      api: {
        push: serverPushApi.server.push,
        request: serverRequestApi.server.request,
        onPush: clientPushApi.server.onPush,
        onRequest: clientRequestApi.server.onRequest,
      },
    },
  };
}

export {
  type StandardSchema,
  SocketError,
  type SocketEnvelope,
  type Push,
  type ReqRes,
  push,
  request,
  type SocketPacket,
  type WS,
  type BusSchema,
  type CreateSchema,
  type SocketSchemas,
  createSchema,
  createCentralBus,
};
