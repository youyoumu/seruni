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

type Result<TData, TError> = { type: "success"; value: TData } | { type: "failure"; error: TError };
const Result = {
  succeed: <TData, TError>(value: TData): Result<TData, TError> => {
    return { type: "success", value };
  },
  fail: <TData, TError>(error: TError): Result<TData, TError> => {
    return { type: "failure", error };
  },
  isSuccess: <TData, TError>(
    result: Result<TData, TError>,
  ): result is { type: "success"; value: TData } => {
    return result.type === "success";
  },
  isFailure: <TData, TError>(
    result: Result<TData, TError>,
  ): result is { type: "failure"; error: TError } => {
    return result.type === "failure";
  },
};

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
    public cid: string,
    public ws?: WS,
  ) {}
}

class SocketEvent<T extends unknown = unknown> extends Event {
  constructor(
    type: string,
    public envelope: SocketEnvelope<T>,
  ) {
    super(type);
  }
}

class SocketErrorEvent<E extends SocketError> extends SocketEvent<E> {
  static EVENT_NAME = "__error__";
  constructor(envelope: SocketEnvelope<E>) {
    super(SocketErrorEvent.EVENT_NAME, envelope);
  }
}

type Push<T = undefined> = { push: T };
type ReqRes<TReq = undefined, TRes = undefined> = { req: TReq; res: TRes };

type UnknownPush = Push<unknown>;
type UnknownReqRes = ReqRes<unknown, unknown>;

const SOCKET_MAGIC_NUMBER = 16777619 as const;
interface SocketPacket {
  "sock.et": typeof SOCKET_MAGIC_NUMBER;
  type: "push" | "req" | "res";
  name: string;
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
    const push = (...data: Arg<CPush[T]["push"]>) => {
      /** [1] */
      this.dispatchEvent(new SocketEvent(clientEvent, new SocketEnvelope(data[0], uid())));
    };

    /** used on server: to handle data from client */
    const handle = (handler: (payload: CPush[T]["push"]) => void) => {
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
        "sock.et": SOCKET_MAGIC_NUMBER,
        type: "push",
        name: clientEvent,
        envelope: e.envelope,
      };
      this.#clientWS.ws.send(JSON.stringify(payload));
    });

    return { push, handle };
  }

  /** used on server: to forward data from WebSocket through events */
  onPushPayload(payload: SocketPacket) {
    /** [2] */
    this.dispatchEvent(new SocketEvent(payload.name, payload.envelope));
  }

  setup(clientPush: (keyof CPush & string)[]) {
    type ClientPush = { [K in keyof CPush]: (...data: Arg<CPush[K]["push"]>) => void };
    type ServerHandlePush = {
      [K in keyof CPush]: (handler: (payload: CPush[K]["push"]) => void) => () => void;
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
    const push = (...data: Arg<SPush[T]["push"]>) => {
      /** [3] */
      this.dispatchEvent(new SocketEvent(serverEvent, new SocketEnvelope(data[0], uid())));
    };

    /** used on client: to handle data from server */
    const handle = (handler: (payload: SPush[T]["push"]) => void) => {
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
          "sock.et": SOCKET_MAGIC_NUMBER,
          type: "push",
          name: serverEvent,
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
    this.dispatchEvent(new SocketEvent(payload.name, payload.envelope));
  }

  setup(serverPush: (keyof SPush & string)[]) {
    type ClientHandlePush = {
      [K in keyof SPush]: (handler: (payload: SPush[K]["push"]) => void) => () => void;
    };
    type ServerPush = { [K in keyof SPush]: (...data: Arg<SPush[K]["push"]>) => void };

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

const DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
type RequestOption = { timeout?: number } | undefined;

class ServerResBus extends EventTarget {
  /** used on client: to forward response data from WebSocket through events */
  onResponsePayload(payload: SocketPacket) {
    /** [7] */
    this.dispatchEvent(new SocketEvent(payload.name, payload.envelope));
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

  constructor(
    sResBus: SResBus,
    clientWS: ClientWS,
    serverWS: ServerWS,
    private timeout = DEFAULT_TIMEOUT,
  ) {
    super();
    this.#sResBus = sResBus;
    this.#clientWS = clientWS;
    this.#serverWS = serverWS;
  }

  linkRequest<T extends keyof CReq & string>(clientEvent: T) {
    if (this.#reqEvents.has(clientEvent)) throw new Error(`Event ${clientEvent} is already linked`);
    this.#reqEvents.add(clientEvent);

    type ReqType = CReq[T]["req"];
    type ResType = CReq[T]["res"];

    /** used on client: to send a request to server and receive response */
    const request = (...data: Arg<ReqType, RequestOption>): Promise<ResType> => {
      const cid = uid();
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutDuration = data[1]?.timeout ?? this.timeout;

      return new Promise((resolve, reject) => {
        const cleanup = () => {
          this.#sResBus.removeEventListener(SocketErrorEvent.EVENT_NAME, handleError);
          this.#sResBus.removeEventListener(clientEvent, handler);
        };

        const handler = (e: Event) => {
          if (!(e instanceof SocketEvent)) return;
          if (e.envelope.cid === cid) {
            clearTimeout(timeoutId);
            cleanup();
            resolve(e.envelope.data);
          }
        };
        /** [7] */
        this.#sResBus.addEventListener(clientEvent, handler);

        const handleError = (e: Event) => {
          if (!(e instanceof SocketErrorEvent)) return;
          if (e.envelope.cid === cid) {
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
        this.dispatchEvent(new SocketEvent(clientEvent, new SocketEnvelope(data[0], cid)));
      });
    };

    /** used on server: to handle request from client and return response */
    const handle = (handler: (payload: ReqType) => ResType | Promise<ResType>) => {
      const handler_ = async (e: Event) => {
        if (!(e instanceof SocketEvent)) return;
        const result = await handler(e.envelope.data);
        /** [7] */
        this.#sResBus.dispatchEvent(
          new SocketEvent(clientEvent, new SocketEnvelope(result, e.envelope.cid)),
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
        "sock.et": SOCKET_MAGIC_NUMBER,
        type: "req",
        name: clientEvent,
        envelope: e.envelope,
      };

      if (this.#clientWS.ws?.readyState === WebSocket.OPEN) {
        this.#clientWS.ws?.send(JSON.stringify(payload));
      } else {
        /** [7] */
        this.#sResBus.dispatchEvent(
          new SocketErrorEvent(
            new SocketEnvelope(new SocketError(SocketError.ConnectionClosed), e.envelope.cid),
          ),
        );
      }
    });

    /** [7] */
    /** used on server: to forward response to client through WebSocket */
    this.#sResBus.addEventListener(clientEvent, (e: Event) => {
      if (!(e instanceof SocketEvent)) return;
      const payload: SocketPacket = {
        "sock.et": SOCKET_MAGIC_NUMBER,
        type: "res",
        name: clientEvent,
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
    this.dispatchEvent(new SocketEvent(payload.name, payload.envelope));
  }

  setup(clientRequest: (keyof CReq & string)[]) {
    type ClientRequest = {
      [K in keyof CReq]: (...data: Arg<CReq[K]["req"], RequestOption>) => Promise<CReq[K]["res"]>;
    };
    type ServerHandleRequest = {
      [K in keyof CReq]: (
        handler: (payload: CReq[K]["req"]) => CReq[K]["res"] | Promise<CReq[K]["res"]>,
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
    this.dispatchEvent(new SocketEvent(payload.name, payload.envelope));
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

  constructor(
    cResBus: CResBus,
    serverWS: ServerWS,
    clientWS: ClientWS,
    private timeout = DEFAULT_TIMEOUT,
  ) {
    super();
    this.#cResBus = cResBus;
    this.#serverWS = serverWS;
    this.#clientWS = clientWS;
  }

  linkRequest<T extends keyof SReq & string>(serverEvent: T) {
    if (this.#reqEvents.has(serverEvent)) throw new Error(`Event ${serverEvent} is already linked`);
    this.#reqEvents.add(serverEvent);

    type ReqType = SReq[T]["req"];
    type ResType = SReq[T]["res"];

    /** used on server: to send a request to all connected clients and receive responses */
    const request = (...data: Arg<ReqType, RequestOption>): Promise<ResType>[] => {
      return Array.from(this.#serverWS.ws).map((ws) => {
        const cid = uid();
        const timeoutDuration = data[1]?.timeout ?? this.timeout;
        let timeoutId: ReturnType<typeof setTimeout>;

        return new Promise((resolve, reject) => {
          const cleanup = () => {
            this.#cResBus.removeEventListener(SocketErrorEvent.EVENT_NAME, handleError);
            this.#cResBus.removeEventListener(serverEvent, handler);
          };

          const handler = (e: Event) => {
            if (!(e instanceof SocketEvent)) return;
            if (e.envelope.cid === cid && e.envelope.ws === ws) {
              clearTimeout(timeoutId);
              cleanup();
              resolve(e.envelope.data);
            }
          };
          /** [10] */
          this.#cResBus.addEventListener(serverEvent, handler);

          const handleError = (e: Event) => {
            if (!(e instanceof SocketErrorEvent)) return;
            if (e.envelope.cid === cid && e.envelope.ws === ws) {
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
          this.dispatchEvent(new SocketEvent(serverEvent, new SocketEnvelope(data[0], cid)));
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
          new SocketEvent(serverEvent, new SocketEnvelope(result, e.envelope.cid)),
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
        "sock.et": SOCKET_MAGIC_NUMBER,
        type: "req",
        name: serverEvent,
        envelope: e.envelope,
      };
      this.#serverWS.ws.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(payload));
        } else {
          /** [10] */
          this.#cResBus.dispatchEvent(
            new SocketErrorEvent(
              new SocketEnvelope(new SocketError(SocketError.ConnectionClosed), e.envelope.cid, ws),
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
        "sock.et": SOCKET_MAGIC_NUMBER,
        type: "res",
        name: serverEvent,
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
    this.dispatchEvent(new SocketEvent(payload.name, payload.envelope));
  }

  setup(serverRequest: (keyof SReq & string)[]) {
    type ServerRequest = {
      [K in keyof SReq]: (...data: Arg<SReq[K]["req"], RequestOption>) => Promise<SReq[K]["res"]>[];
    };
    type ClientHandleRequest = {
      [K in keyof SReq]: (
        handler: (payload: SReq[K]["req"]) => SReq[K]["res"] | Promise<SReq[K]["res"]>,
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

type PushSchemas<T extends Record<string, StandardSchema>> = {
  [K in keyof T]: Push<InferOutput<T[K]>>;
};
type RequestSchemas<T extends Record<string, [StandardSchema, StandardSchema]>> = {
  [K in keyof T]: ReqRes<InferOutput<T[K][0]>, InferOutput<T[K][1]>>;
};

type SocketSchemas = {
  clientPushes: Record<string, StandardSchema>;
  serverPushes: Record<string, StandardSchema>;
  clientRequests: Record<string, [StandardSchema, StandardSchema]>;
  serverRequests: Record<string, [StandardSchema, StandardSchema]>;
};

function defineSocketSchema<T extends SocketSchemas>(schema: T) {
  return schema;
}

function createSocket<const Schema extends SocketSchemas>(
  schemas: Schema,
  options?: {
    clientTimeout?: number;
    serverTimeout?: number;
  },
) {
  type CPush = PushSchemas<NonNullable<Schema["clientPushes"]>>;
  type SPush = PushSchemas<NonNullable<Schema["serverPushes"]>>;
  type CReq = RequestSchemas<NonNullable<Schema["clientRequests"]>>;
  type SReq = RequestSchemas<NonNullable<Schema["serverRequests"]>>;

  const clientWS = new ClientWS();
  const serverWS = new ServerWS();

  const cPushBus = new ClientPushBus<CPush>(clientWS);
  const sPushBus = new ServerPushBus<SPush>(serverWS);

  const sResBus = new ServerResBus();
  const cReqBus = new ClientReqBus<CReq, ServerResBus>(
    sResBus,
    clientWS,
    serverWS,
    options?.clientTimeout,
  );

  const cResBus = new ClientResBus();
  const sReqBus = new ServerReqBus<SReq, ClientResBus>(
    cResBus,
    serverWS,
    clientWS,
    options?.serverTimeout,
  );

  const validatePush = async (
    tag: string,
    data: unknown,
    pushSchemas: Schema["clientPushes"] | Schema["serverPushes"],
  ): Promise<Result<unknown, Error>> => {
    const schema = pushSchemas?.[tag];
    if (!schema) throw new Error(`No schema found for push [${tag}]`);
    const result = await schema["~standard"].validate(data);
    if ("issues" in result) {
      const error = new Error(`Validation failed for push [${tag}]`, { cause: result.issues });
      console.error(error.message, error.cause);
      return Result.fail(error);
    }
    return Result.succeed(result.value);
  };

  const validateRequest = async (
    tag: string,
    data: unknown,
    reqSchemas: Schema["clientRequests"] | Schema["serverRequests"],
    type: "request" | "response",
  ) => {
    const schema = reqSchemas?.[tag];
    if (!schema) throw new Error(`No schema found for request [${tag}]`);
    const schemaToUse = type === "request" ? schema[0] : schema[1];
    const result = await schemaToUse["~standard"].validate(data);
    if ("issues" in result) {
      const error = new Error(`Validation failed for ${type} [${tag}]`, { cause: result.issues });
      console.error(error.message, error.cause);
      return Result.fail(error);
    }
    return Result.succeed(result.value);
  };

  const validateEvent = (e: MessageEvent): Result<SocketPacket, undefined> => {
    if (!(e instanceof MessageEvent)) return Result.fail(undefined);
    if (typeof e.data !== "string") return Result.fail(undefined);
    try {
      const payload = JSON.parse(e.data) as unknown;
      if (typeof payload !== "object" || payload === null) return Result.fail(undefined);
      if (
        "sock.et" in payload &&
        "type" in payload &&
        "name" in payload &&
        "envelope" in payload &&
        payload["sock.et"] === SOCKET_MAGIC_NUMBER &&
        typeof payload.type === "string" &&
        typeof payload.name === "string" &&
        typeof payload.envelope === "object" &&
        payload.envelope !== null &&
        (payload.type === ("req" as const) ||
          payload.type === ("res" as const) ||
          payload.type === ("push" as const)) &&
        "cid" in payload.envelope &&
        typeof payload.envelope.cid === "string"
      ) {
        const data = "data" in payload.envelope ? payload.envelope.data : undefined;
        const result = {
          "sock.et": payload["sock.et"],
          name: payload.name,
          type: payload.type,
          envelope: new SocketEnvelope(data, payload.envelope.cid),
        };
        return Result.succeed(result);
      }
    } catch {}
    return Result.fail(undefined);
  };

  const cOnMessage = async (event: MessageEvent) => {
    const result = validateEvent(event);
    if (Result.isFailure(result)) return;
    const payload = result.value;
    switch (payload.type) {
      case "push": {
        const result = await validatePush(
          payload.name,
          payload.envelope.data,
          schemas.serverPushes,
        );
        if (Result.isFailure(result)) return;
        payload.envelope.data = result.value;
        return sPushBus.onPushPayload(payload);
      }
      case "req": {
        const result = await validateRequest(
          payload.name,
          payload.envelope.data,
          schemas.serverRequests,
          "request",
        );
        if (Result.isFailure(result)) return;
        payload.envelope.data = result.value;
        return sReqBus.onRequestPayload(payload);
      }
      case "res": {
        const result = await validateRequest(
          payload.name,
          payload.envelope.data,
          schemas.clientRequests,
          "response",
        );
        if (Result.isFailure(result)) return;
        payload.envelope.data = result.value;
        return sResBus.onResponsePayload(payload);
      }
    }
  };

  const sOnMessage = async (event: MessageEvent, ws: WS) => {
    const result = validateEvent(event);
    if (Result.isFailure(result)) return;
    const payload = result.value;
    payload.envelope.ws = ws;
    switch (payload.type) {
      case "push": {
        const result = await validatePush(
          payload.name,
          payload.envelope.data,
          schemas.clientPushes,
        );
        if (Result.isFailure(result)) return;
        payload.envelope.data = result.value;
        return cPushBus.onPushPayload(payload);
      }
      case "req": {
        const result = await validateRequest(
          payload.name,
          payload.envelope.data,
          schemas.clientRequests,
          "request",
        );
        if (Result.isFailure(result)) return;
        payload.envelope.data = result.value;
        return cReqBus.onRequestPayload(payload);
      }
      case "res": {
        const result = await validateRequest(
          payload.name,
          payload.envelope.data,
          schemas.serverRequests,
          "response",
        );
        if (Result.isFailure(result)) return;
        payload.envelope.data = result.value;
        return cResBus.onResponsePayload(payload);
      }
    }
  };

  const clientPushApi = cPushBus.setup(Object.keys(schemas.clientPushes ?? {}));
  const clientRequestApi = cReqBus.setup(Object.keys(schemas.clientRequests ?? {}));
  const serverPushApi = sPushBus.setup(Object.keys(schemas.serverPushes ?? {}));
  const serverRequestApi = sReqBus.setup(Object.keys(schemas.serverRequests ?? {}));

  return {
    client: {
      onMessage: cOnMessage,
      bindWS: clientWS.bindWS.bind(clientWS),
      api: {
        push: clientPushApi.client.push,
        request: clientRequestApi.client.request,
        onPush: serverPushApi.client.onPush,
        onRequest: serverRequestApi.client.onRequest,
      },
    },
    server: {
      onMessage: sOnMessage,
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

function createClientSocket<T extends SocketSchemas>(schemas: T, options?: { timeout?: number }) {
  return createSocket(schemas, { clientTimeout: options?.timeout }).client;
}

function createServerSocket<T extends SocketSchemas>(schemas: T, options?: { timeout?: number }) {
  return createSocket(schemas, { serverTimeout: options?.timeout }).server;
}

export {
  type StandardSchema,
  SocketError,
  type SocketEnvelope,
  type SocketPacket,
  type WS,
  type SocketSchemas,
  createClientSocket,
  createServerSocket,
  defineSocketSchema,
};
