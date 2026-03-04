import { type StandardSchemaV1 } from "@standard-schema/spec";
import { uid } from "uid";
import { z } from "zod/mini";

export type StandardSchema = StandardSchemaV1;

type InferOutput<Schema extends StandardSchema> = StandardSchemaV1.InferOutput<Schema>;

export class SocketError extends Error {
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

class ResponseErrorEvent<E extends SocketError = SocketError> extends CustomEvent<
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

interface PushSchema<T extends StandardSchema = StandardSchema> {
  type: "push";
  schema: T;
}
interface RequestSchema<
  TReq extends StandardSchema = StandardSchema,
  TRes extends StandardSchema = StandardSchema,
> {
  type: "request";
  requestSchema: TReq;
  responseSchema: TRes;
}

export function push<T extends StandardSchema = StandardSchema>(schema?: T): PushSchema<T> {
  return {
    type: "push",
    schema: (schema ?? z.undefined()) as unknown as T,
  };
}

export function request<TReq extends StandardSchema, TRes extends StandardSchema>(
  requestSchema: TReq,
  responseSchema: TRes,
): RequestSchema<TReq, TRes> {
  return {
    type: "request",
    requestSchema,
    responseSchema,
  };
}

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
      this.dispatchEvent(
        new CustomEvent(clientEvent, {
          detail: { correlationId: uid(), data: data[0] },
        }),
      );
    };

    /** used on server: to handle data from client */
    const handle = (handler: (payload: CPush[T]["payload"]) => void) => {
      const handler_ = (e: CustomEventInit<WithCorrelationId<unknown>>) => {
        handler(e.detail?.data);
      };
      /** [2] */
      this.addEventListener(clientEvent, handler_);
      return () => this.removeEventListener(clientEvent, handler_);
    };

    /** [1] */
    /** used on client: to forward events to server through WebSocket */
    this.addEventListener(clientEvent, (e: CustomEventInit<WithCorrelationId<unknown>>) => {
      if (this.#clientWS.ws?.readyState !== WebSocket.OPEN) return;
      const payload: WSPayload = {
        __wsBus__: true,
        type: "push",
        tag: clientEvent,
        data: e.detail as WithCorrelationId<unknown>,
      };
      this.#clientWS.ws.send(JSON.stringify(payload));
    });

    return { push, handle };
  }

  /** used on server: to forward data from WebSocket through events */
  onPushPayload(payload: WSPayload) {
    /** [2] */
    this.dispatchEvent(new CustomEvent(payload.tag, { detail: payload.data }));
  }

  setup(clientPush: Record<keyof CPush, 0>) {
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

    Object.keys(clientPush).forEach((key) => {
      const api = this.linkPush(key as CPush & string);
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
      this.dispatchEvent(
        new CustomEvent(serverEvent, {
          detail: { correlationId: uid(), data: data[0] },
        }),
      );
    };

    /** used on client: to handle data from server */
    const handle = (handler: (payload: SPush[T]["payload"]) => void) => {
      const handler_ = (e: CustomEventInit<WithCorrelationId<unknown>>) => {
        handler(e.detail?.data);
      };
      /** [4] */
      this.addEventListener(serverEvent, handler_);
      return () => this.removeEventListener(serverEvent, handler_);
    };

    /** [3] */
    /** used on server: to forward events to all connected clients through WebSocket */
    this.addEventListener(serverEvent, (e: CustomEventInit<WithCorrelationId<unknown>>) => {
      this.#serverWS.ws.forEach((ws) => {
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

    return { push, handle };
  }

  /** used on client: to forward data from WebSocket through events */
  onPushPayload(payload: WSPayload) {
    /** [4] */
    this.dispatchEvent(new CustomEvent(payload.tag, { detail: payload.data }));
  }

  setup(serverPush: Record<keyof SPush, 0>) {
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

    Object.keys(serverPush).forEach((key) => {
      const api = this.linkPush(key as SPush & string);
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
const ERROR_EVENT = "__error__";
type RequestOption = { timeout?: number } | undefined;

class ServerResBus extends EventTarget {
  /** used on client: to forward response data from WebSocket through events */
  onResponsePayload(payload: WSPayload) {
    /** [7] */
    this.dispatchEvent(new CustomEvent(payload.tag, { detail: payload.data }));
  }
}

class ClientReqBus<
  CReq extends Record<string, UnknownRequest>,
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
        /** [7] */
        this.#sResBus.addEventListener(clientEvent, handler);

        const handleError = (e: CustomEventInit<WithCorrelationId<SocketError>>) => {
          const detail = e.detail as WithCorrelationId<SocketError>;
          if (detail.correlationId === correlationId) {
            clearTimeout(timeoutId);
            cleanup();
            reject(detail.data);
          }
        };
        /** [7] */
        this.#sResBus.addEventListener(ERROR_EVENT, handleError);

        timeoutId = setTimeout(() => {
          cleanup();
          reject(new SocketError("requestTimeout"));
        }, timeoutDuration);

        /** [5] */
        this.dispatchEvent(
          new CustomEvent(clientEvent, {
            detail: { correlationId, data: data[0] },
          }),
        );
      });
    };

    /** used on server: to handle request from client and return response */
    const handle = (handler: (payload: ReqType) => ResType | Promise<ResType>) => {
      const handler_ = async (e: CustomEventInit<WithCorrelationId<unknown>>) => {
        const detail = e.detail as WithCorrelationId<unknown>;
        const result = await handler(detail.data);
        /** [7] */
        this.#sResBus.dispatchEvent(
          new CustomEvent(clientEvent, {
            detail: { data: result, correlationId: detail.correlationId },
          }),
        );
      };
      /** [6] */
      this.addEventListener(clientEvent, handler_);
      return () => this.removeEventListener(clientEvent, handler_);
    };

    /** [5] */
    /** used on client: to forward request to server through WebSocket */
    this.addEventListener(clientEvent, (e: CustomEventInit<WithCorrelationId<unknown>>) => {
      const detail = e.detail as WithCorrelationId<unknown>;
      const payload: WSPayload = {
        __wsBus__: true,
        type: "req",
        tag: clientEvent,
        data: detail,
      };

      if (this.#clientWS.ws?.readyState === WebSocket.OPEN) {
        this.#clientWS.ws?.send(JSON.stringify(payload));
      } else {
        /** [7] */
        this.#sResBus.dispatchEvent(
          new ResponseErrorEvent(ERROR_EVENT, {
            detail: {
              data: new SocketError("connectionClosed"),
              correlationId: detail.correlationId,
            },
          }),
        );
      }
    });

    /** [7] */
    /** used on server: to forward response to client through WebSocket */
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
        this.#serverWS.ws.forEach((ws) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
        });
      },
    );

    return { request, handle };
  }

  /** used on server: to forward request data from WebSocket through events */
  onRequestPayload(payload: WSPayload) {
    /** [6] */
    this.dispatchEvent(new CustomEvent(payload.tag, { detail: payload.data }));
  }

  setup(clientRequest: Record<keyof CReq, 0>) {
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

    Object.keys(clientRequest).forEach((key) => {
      const api = this.linkRequest(key as CReq & string);
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
  onResponsePayload(payload: WSPayload) {
    /** [10] */
    this.dispatchEvent(new CustomEvent(payload.tag, { detail: payload.data }));
  }
}

class ServerReqBus<
  SReq extends Record<string, UnknownRequest>,
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
          /** [10] */
          this.#cResBus.addEventListener(serverEvent, handler);

          const handleError = (e: CustomEventInit<WithCorrelationId<SocketError>>) => {
            const detail = e.detail as WithCorrelationId<SocketError>;
            if (detail.correlationId === correlationId && detail.ws === ws) {
              clearTimeout(timeoutId);
              cleanup();
              reject(detail.data);
            }
          };
          /** [10] */
          this.#cResBus.addEventListener(ERROR_EVENT, handleError);

          timeoutId = setTimeout(() => {
            cleanup();
            reject(new SocketError("requestTimeout"));
          }, timeoutDuration);

          /** [8] */
          this.dispatchEvent(
            new CustomEvent(serverEvent, {
              detail: { correlationId, data: data[0] },
            }),
          );
        });
      });
    };

    /** used on client**: to handle request from server and return response */
    const handle = (handler: (payload: ReqType) => ResType | Promise<ResType>) => {
      const handler_ = async (e: CustomEventInit) => {
        const detail = e.detail;
        const result = await handler(detail.data);
        /** [10] */
        this.#cResBus.dispatchEvent(
          new CustomEvent(serverEvent, {
            detail: { data: result, correlationId: detail.correlationId },
          }),
        );
      };
      /** [9] */
      this.addEventListener(serverEvent, handler_);
      return () => this.removeEventListener(serverEvent, handler_);
    };

    /** [8] */
    /** used on server: to forward request to all connected clients through WebSocket */
    this.addEventListener(serverEvent, (e: CustomEventInit<WithCorrelationId<unknown>>) => {
      const detail = e.detail as WithCorrelationId<unknown>;
      const payload: WSPayload = {
        __wsBus__: true,
        type: "req",
        tag: serverEvent,
        data: detail,
      };
      this.#serverWS.ws.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(payload));
        } else {
          /** [10] */
          this.#cResBus.dispatchEvent(
            new ResponseErrorEvent(ERROR_EVENT, {
              detail: {
                data: new SocketError("connectionClosed"),
                correlationId: detail.correlationId,
                ws,
              },
            }),
          );
        }
      });
    });

    /** [10] */
    /** used on client**: to forward response to server through WebSocket */
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
        const ws = this.#clientWS.ws;
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
      },
    );

    return { request, handle };
  }

  /** used on client: to forward request data from WebSocket through events */
  onRequestPayload(payload: WSPayload) {
    /** [9] */
    this.dispatchEvent(new CustomEvent(payload.tag, { detail: payload.data }));
  }

  setup(serverRequest: Record<keyof SReq, 0>) {
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

    Object.keys(serverRequest).forEach((key) => {
      const api = this.linkRequest(key as SReq & string);
      result.client.onRequest[key] = api.handle;
      result.server.request[key] = api.request;
    });

    return result as {
      client: { onRequest: ClientHandleRequest };
      server: { request: ServerRequest };
    };
  }
}

export type BusSchema = {
  clientPush?: Record<string, UnknownPush>;
  serverPush?: Record<string, UnknownPush>;
  clientRequest?: Record<string, UnknownRequest>;
  serverRequest?: Record<string, UnknownRequest>;
};
export type CreateSchema<T extends BusSchema> = T;

type PushSchemas<T extends Record<string, PushSchema>> = {
  [K in keyof T]: T[K] extends PushSchema<infer S> ? Push<InferOutput<S>> : never;
};
type RequestSchemas<T extends Record<string, RequestSchema>> = {
  [K in keyof T]: T[K] extends RequestSchema<infer Req, infer Res>
    ? Request<InferOutput<Req>, InferOutput<Res>>
    : never;
};

export type SocketSchemas = {
  clientPush?: Record<string, PushSchema>;
  serverPush?: Record<string, PushSchema>;
  clientRequest?: Record<string, RequestSchema>;
  serverRequest?: Record<string, RequestSchema>;
};

export function createSchema<const T extends SocketSchemas>(schemas: T): T {
  return schemas;
}

export function createCentralBus<const Schema extends SocketSchemas>(schemas: Schema) {
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
    if (!schema || schema.type !== "request") return data;
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

  const cOnPayload = async (payload: WSPayload) => {
    if (!payload?.__wsBus__) return;
    switch (payload.type) {
      case "push":
        payload.data.data = await validatePush(payload.tag, payload.data.data, schemas.serverPush);
        if (payload.data.data instanceof Error) return;
        return sPushBus.onPushPayload(payload);
      case "req":
        payload.data.data = await validateRequest(
          payload.tag,
          payload.data.data,
          schemas.serverRequest,
          false,
        );
        if (payload.data.data instanceof Error) return;
        return sReqBus.onRequestPayload(payload);
      case "res":
        payload.data.data = await validateRequest(
          payload.tag,
          payload.data.data,
          schemas.clientRequest,
          true,
        );
        if (payload.data.data instanceof Error) return;
        return sResBus.onResponsePayload(payload);
    }
  };

  const sOnPayload = async (payload: WSPayload, ws: WS) => {
    if (!payload?.__wsBus__) return;
    payload.data.ws = ws;
    switch (payload.type) {
      case "push":
        payload.data.data = await validatePush(payload.tag, payload.data.data, schemas.clientPush);
        if (payload.data.data instanceof Error) return;
        return cPushBus.onPushPayload(payload);
      case "req":
        payload.data.data = await validateRequest(
          payload.tag,
          payload.data.data,
          schemas.clientRequest,
          false,
        );
        if (payload.data.data instanceof Error) return;
        return cReqBus.onRequestPayload(payload);
      case "res":
        payload.data.data = await validateRequest(
          payload.tag,
          payload.data.data,
          schemas.serverRequest,
          true,
        );
        if (payload.data.data instanceof Error) return;
        return cResBus.onResponsePayload(payload);
    }
  };

  const clientPushApi = cPushBus.setup(
    Object.fromEntries(Object.keys(schemas.clientPush ?? {}).map((k) => [k, 0])) as Record<
      keyof CPush,
      0
    >,
  );
  const clientRequestApi = cReqBus.setup(
    Object.fromEntries(Object.keys(schemas.clientRequest ?? {}).map((k) => [k, 0])) as Record<
      keyof CReq,
      0
    >,
  );
  const serverPushApi = sPushBus.setup(
    Object.fromEntries(Object.keys(schemas.serverPush ?? {}).map((k) => [k, 0])) as Record<
      keyof SPush,
      0
    >,
  );
  const serverRequestApi = sReqBus.setup(
    Object.fromEntries(Object.keys(schemas.serverRequest ?? {}).map((k) => [k, 0])) as Record<
      keyof SReq,
      0
    >,
  );

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
