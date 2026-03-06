import { type StandardSchemaV1 } from "@standard-schema/spec";

type StandardSchema = StandardSchemaV1;
type StandardValidator = Pick<StandardSchema, "~standard">;
type Infer<T extends StandardSchema> = StandardSchemaV1.InferOutput<T>;
type InferReqRes<T extends StandardSchema | undefined> = T extends StandardSchema
  ? StandardSchemaV1.InferOutput<T>
  : undefined;
type InferErr<T extends StandardSchema | undefined> = T extends StandardSchema
  ? StandardSchemaV1.InferOutput<T>
  : never;
/**
 * Tuple representing the schemas for a request-response pair: [request, response, error].
 */
type ReqSchemaTuple = [
  (StandardSchema | undefined)?,
  (StandardSchema | undefined)?,
  (StandardSchema | undefined)?,
];

/**
 * Utility type to infer function arguments from schema and options.
 * Handles optional arguments correctly.
 */
type Arg<T1, T2 = undefined> = undefined extends T1
  ? undefined extends T2
    ? [arg1?: T1, arg2?: T2]
    : [arg1: T1 | undefined, arg2: T2]
  : undefined extends T2
    ? [arg1: T1, arg2?: T2]
    : [arg1: T1, arg2: T2];

type SocketErr =
  | typeof SocketError.ConnectionClosed
  | typeof SocketError.RequestTimeout
  | typeof SocketError.InvalidResponse;
class SocketError extends Error {
  static ConnectionClosed = "ConnectionClosed" as const;
  static RequestTimeout = "RequestTimeout" as const;
  static InvalidResponse = "InvalidResponse" as const;
  constructor(public readonly type: SocketErr) {
    super();
    this.name = "SocketError";
  }
}
class SocketFailure {
  constructor(public readonly error: unknown) {}
}
/**
 * Represents the response from a socket request.
 * It can either be a Success with a value or a Failure with an error.
 */
type SocketResponse<T = unknown, E = unknown> = [E] extends [never]
  ? { type: "Success"; value: T }
  : { type: "Success"; value: T } | { type: "Failure"; error: E };

/**
 * Container for the payload value in a socket packet.
 */
interface SocketBody<T = unknown> {
  value?: T;
}

/**
 * Wire-level packet exchanged between client and server.
 */
interface SocketPacket {
  /** Packet intent: PUSH, REQ, RES, or ERR */
  method: "PUSH" | "REQ" | "RES" | "ERR";
  /** Schema key or route name */
  route: string;
  /** Validated payload container */
  body: SocketBody;
  /** Protocol metadata (correlation ID, timestamp, cookies) */
  headers?: SocketHeaders;
}

/**
 * Protocol metadata for socket packets.
 */
interface SocketHeaders {
  /** Correlation ID for requests and responses */
  cid?: string;
  /** Timestamp when the packet was created */
  timestamp?: number;
  /** Cookies sent from client to server */
  cookie?: Record<string, string>;
  /** Cookies to be set on the client */
  "set-cookie"?: Record<string, string>;
}

/**
 * Context provided to request handlers.
 */
interface SocketReqHandlerContext<TBody = unknown, TErr = unknown> {
  /** The WebSocket instance that received the request */
  ws: WS;
  /** The incoming request packet */
  req: Readonly<{
    method: "REQ";
    route: string;
    body: TBody;
    headers: Readonly<SocketHeaders>;
  }>;
  /** The response being prepared */
  res: {
    method: "RES" | "ERR";
    route: string;
    header: SocketHeaders;
    body?: unknown;
  };
  /**
   * Immediately fails the request with the provided error.
   * @param error The error to return to the requester.
   */
  fail: (error: TErr) => never;
}

/**
 * Context provided to push handlers.
 */
interface SocketPushHandlerContext<TBody = unknown> {
  /** The WebSocket instance that received the push */
  ws: WS;
  /** The incoming push packet */
  push: Readonly<{
    method: "PUSH";
    route: string;
    body: TBody;
    headers: Readonly<SocketHeaders>;
  }>;
}

/**
 * Continues to the next middleware in the chain.
 */
type SocketNext = () => Promise<void>;

/**
 * Handler for push messages.
 */
type SocketPushHandler<TBody = unknown> = (
  c: SocketPushHandlerContext<TBody>,
) => void | Promise<void>;

/**
 * Middleware or handler for request messages.
 * Return a value to set the response body, or use `c.res.body`.
 */
type SocketReqMiddleware<TReq = unknown, TRes = unknown, TErr = unknown> = (
  c: SocketReqHandlerContext<TReq, TErr>,
  next: SocketNext,
) => TRes | void | Promise<TRes | void>;

/**
 * Defines which routes a middleware should apply to.
 */
type SocketRequestMatcher<Route extends string> =
  | Route
  | Route[]
  | RegExp
  | ((c: SocketReqHandlerContext<unknown>) => boolean | Promise<boolean>);

/**
 * Metadata tracked for each connected client.
 */
interface SocketClientMeta {
  /** When the client connected */
  readonly connectedAt: number;
  /** Total number of messages received from this client */
  messageCount: number;
  /** Timestamp of the last message received from this client */
  lastMessageAt: number | null;
}

/**
 * Minimal WebSocket interface required by the library.
 */
interface WS {
  send: (data: string) => void;
  readyState: WebSocket["readyState"];
}

type PushSchemas<T extends Record<string, StandardSchema>> = {
  [K in keyof T]: { push: Infer<T[K]> };
};
type ReqSchemas<T extends Record<string, ReqSchemaTuple>> = {
  [K in keyof T]: { req: InferReqRes<T[K][0]>; res: InferReqRes<T[K][1]>; err: InferErr<T[K][2]> };
};

/**
 * Schema definition for the socket communication.
 */
interface SocketSchemas {
  /** Pushes initiated by the client */
  clientPushes: Record<string, StandardSchema>;
  /** Pushes initiated by the server */
  serverPushes: Record<string, StandardSchema>;
  /** Requests initiated by the client */
  clientRequests: Record<string, ReqSchemaTuple>;
  /** Requests initiated by the server */
  serverRequests: Record<string, ReqSchemaTuple>;
}

type ServerRequestTargetPicker = (clients: WS[]) => WS | undefined;
type ServerPushTargetPicker = (clients: WS[]) => WS | WS[] | undefined;

/**
 * Options for a single request.
 */
type RequestOption = { timeout?: number } | undefined;

/**
 * Options for a server-to-client request, allowing targeting specific clients.
 */
type ServerRequestTargetOption = { timeout?: number } & { ws: WS | ServerRequestTargetPicker };
type ServerRequestOption = RequestOption | ServerRequestTargetOption;

/**
 * Options for a server-to-client push, allowing targeting specific clients.
 */
type ServerPushTargetOption = { ws: WS | WS[] | ServerPushTargetPicker };
type ServerPushOption = ServerPushTargetOption | undefined;

/**
 * Context provided to global error handlers.
 */
type SocketErrorHandlerContext = {
  /** The request that caused the error */
  req: Readonly<{
    method: "REQ";
    route: string;
    headers: Readonly<SocketHeaders>;
  }>;
  /** The error response being prepared */
  res: {
    method: "ERR";
    route: string;
    header: SocketHeaders;
    body?: unknown;
  };
  /** The original error that occurred */
  error: unknown;
};

/**
 * Global error handler for unhandled exceptions in request processing.
 */
type SocketErrorHandler<T = unknown> = (ctx: SocketErrorHandlerContext) => T | Promise<T>;

/**
 * Options for constructing a socket.
 */
type SocketConstructOption =
  | {
      /** Default timeout for requests in milliseconds */
      timeout?: number;
      /** Function to generate unique IDs for requests */
      uid?: () => string;
      /** Global error handler */
      onError?: SocketErrorHandler;
      /** Protocol version ID to prevent cross-talk between different applications */
      protocolId?: number;
    }
  | undefined;

function defineSocketSchema<T extends SocketSchemas>(schema: T) {
  return schema;
}

const uid = () => Math.random().toString(36).slice(2);
const DEFAULT_PROTOCOL_ID = 16777619;
const DEFAULT_TIMEOUT = 300000;
const undefinedSchema: StandardValidator = {
  "~standard": {
    version: 1,
    vendor: "krissan",
    async validate(data: unknown) {
      if (data === undefined) return { value: undefined } as const;
      return { issues: [{ message: "Invalid input: expected undefined" }] } as const;
    },
  },
};
const neverSchema: StandardValidator = {
  "~standard": {
    version: 1,
    vendor: "krissan",
    async validate(_data: unknown) {
      return { issues: [{ message: "Invalid input: expected never" }] } as const;
    },
  },
};

interface SocketContext {
  ws: WS;
}

class SocketEvent extends Event {
  constructor(
    type: string,
    public body: SocketBody,
    public headers: SocketHeaders = {},
    public context: SocketContext,
    public issues?: unknown,
  ) {
    super(type);
  }
}

class ET extends EventTarget {
  on(
    route: string,
    handler: (packet: {
      body: SocketBody;
      headers: SocketHeaders;
      context: SocketContext;
      issues?: unknown;
    }) => void,
  ) {
    const fn = (e: Event) =>
      e instanceof SocketEvent &&
      handler({ body: e.body, headers: e.headers, context: e.context, issues: e.issues });
    this.addEventListener(route, fn);
    return () => this.removeEventListener(route, fn);
  }
}

class SocketCore<const Schema extends SocketSchemas, ClientState extends object = {}> {
  #schemas: Schema;
  #clientCookie: { value: Record<string, string> } = { value: {} };
  #uid: () => string;
  #onError?: SocketErrorHandler;
  #protocolId: number;
  #prefix: string;
  readonly clientWS: { ws: WS | undefined } = { ws: undefined };
  readonly serverWS = { ws: new Map<WS, { meta: SocketClientMeta } & ClientState>() };
  readonly ets = {
    cPush: new ET(),
    sPush: new ET(),
    cReq: new ET(),
    sReq: new ET(),
    cRes: new ET(),
    sRes: new ET(),
    cErr: new ET(),
    sErr: new ET(),
  };
  readonly clientTimeout: number;
  readonly serverTimeout: number;

  constructor(
    schemas: Schema,
    options?: {
      clientTimeout?: number;
      serverTimeout?: number;
      uid?: () => string;
      onError?: SocketErrorHandler;
      protocolId?: number;
    },
  ) {
    this.#schemas = schemas;
    this.#uid = options?.uid ?? uid;
    this.#onError = options?.onError;
    this.clientTimeout = options?.clientTimeout ?? DEFAULT_TIMEOUT;
    this.serverTimeout = options?.serverTimeout ?? DEFAULT_TIMEOUT;
    this.#protocolId = options?.protocolId ?? DEFAULT_PROTOCOL_ID;
    this.#prefix = `krissan:${this.#protocolId}:`;
  }

  #sanitizeCookie(cookie: unknown): Record<string, string> | undefined {
    if (!cookie || typeof cookie !== "object" || Array.isArray(cookie)) return undefined;
    const sanitized: Record<string, string> = {};
    Object.entries(cookie).forEach(([k, v]) => {
      if (typeof v === "string") sanitized[k] = v;
    });
    return sanitized;
  }

  async #validate(
    schema: StandardSchema | undefined,
    data: unknown,
    route: string,
    method: SocketPacket["method"],
  ) {
    const effectiveSchema: StandardValidator =
      schema ?? (method === "ERR" ? neverSchema : undefinedSchema);
    const res = await effectiveSchema["~standard"].validate(data);
    if ("issues" in res) {
      console.error(`Validation failed for ${method} [${route}]`, res.issues);
      return { success: false as const, error: res.issues };
    }
    return { success: true as const, value: res.value };
  }

  #applySetCookie(setCookie: unknown) {
    const sanitized = this.#sanitizeCookie(setCookie);
    if (!sanitized) return;
    this.#clientCookie.value = sanitized;
  }

  #createHeaders(isClientSender: boolean, cid?: string): SocketHeaders {
    const headers: SocketHeaders = { timestamp: Date.now() };
    if (cid) headers.cid = cid;
    if (isClientSender && Object.keys(this.#clientCookie.value).length > 0) {
      headers.cookie = this.#clientCookie.value;
    }
    return headers;
  }

  #toPredicate(
    matcher: SocketRequestMatcher<string>,
  ): (c: SocketReqHandlerContext<unknown>) => boolean | Promise<boolean> {
    if (typeof matcher === "string") return (c) => c.req.route === matcher;
    if (Array.isArray(matcher)) return (c) => matcher.includes(c.req.route);
    if (matcher instanceof RegExp) return (c) => matcher.test(c.req.route);
    return matcher;
  }

  #send(payload: SocketPacket, ws?: WS) {
    const data = `${this.#prefix}${JSON.stringify(payload)}`;
    if (ws) ws.send(data);
    else if (this.clientWS.ws?.readyState === 1) this.clientWS.ws.send(data);
    else this.serverWS.ws.forEach((_, s) => s.readyState === 1 && s.send(data));
  }

  createRequestContext(
    route: string,
    e: { body: SocketBody; headers: SocketHeaders; context: SocketContext; issues?: unknown },
  ) {
    const res: SocketReqHandlerContext<unknown>["res"] = {
      method: "RES",
      route,
      header: {},
    };
    Object.defineProperty(res, "method", {
      value: "RES",
      writable: false,
      enumerable: true,
      configurable: false,
    });
    Object.defineProperty(res, "route", {
      value: route,
      writable: false,
      enumerable: true,
      configurable: false,
    });
    const c: SocketReqHandlerContext<unknown> = {
      ws: e.context.ws,
      req: Object.freeze({
        method: "REQ" as const,
        route,
        body: e.body.value,
        headers: Object.freeze({ ...e.headers }),
      }),
      res,
      fail: (error: unknown): never => {
        throw new SocketFailure(error);
      },
    };
    return c;
  }

  createPushLane<IsClient extends boolean>(
    events: readonly string[],
    reverseET: ET,
    isClient: IsClient,
  ) {
    const api: {
      push: Partial<Record<string, (...args: Arg<unknown, ServerPushOption>) => void>>;
      handle: Partial<
        Record<string, (handler: (c: SocketPushHandlerContext<unknown>) => void) => () => void>
      >;
    } = { push: {}, handle: {} };
    events.forEach((route) => {
      api.push[route] = (...args) => {
        const data = args[0];
        const options = args[1];

        const exec = (ws?: WS) => {
          this.#send(
            {
              method: "PUSH",
              route,
              body: { value: data },
              headers: this.#createHeaders(isClient),
            },
            ws,
          );
        };

        if (isClient) return exec(this.clientWS.ws);
        if (options && "ws" in options) {
          const target = options.ws;
          if (typeof target === "function") {
            const clients = Array.from(this.serverWS.ws.keys());
            const picked = target(clients);
            if (Array.isArray(picked)) return picked.forEach(exec);
            if (picked) return exec(picked);
            return;
          }
          if (Array.isArray(target)) return target.forEach(exec);
          if (target) return exec(target);
          return;
        }
        exec();
      };
      api.handle[route] = (handler: (c: SocketPushHandlerContext<unknown>) => void) =>
        reverseET.on(route, (e) =>
          handler({
            ws: e.context.ws,
            push: Object.freeze({
              method: "PUSH" as const,
              route,
              body: e.body.value,
              headers: Object.freeze({ ...e.headers }),
            }),
          }),
        );
    });
    return api;
  }

  createReqLane<IsClient extends boolean>(
    events: readonly string[],
    reqET: ET,
    resET: ET,
    errET: ET,
    timeout: number,
    isClient: IsClient,
  ) {
    const api: {
      request: Partial<Record<string, (...args: Arg<unknown, ServerRequestOption>) => unknown>>;
      handle: Partial<
        Record<string, (handler: SocketReqMiddleware<unknown, unknown>) => () => void>
      >;
      use: (
        matcher: SocketRequestMatcher<string>,
        handler: SocketReqMiddleware<unknown, unknown>,
      ) => () => void;
    } = {
      request: {},
      handle: {},
      use: () => () => undefined,
    };
    const middlewareMap: Partial<Record<string, SocketReqMiddleware<unknown, unknown>[]>> = {};

    events.forEach((route) => {
      middlewareMap[route] = [];
      api.request[route] = (...args) => {
        const data = args[0];
        const cid = this.#uid();
        const options = args[1];
        const t = options?.timeout ?? timeout;
        const exec = (ws?: WS): Promise<SocketResponse<unknown>> => {
          return new Promise((resolve, reject) => {
            if (!ws) return reject(new SocketError(SocketError.ConnectionClosed));
            let timer: ReturnType<typeof setTimeout>;
            const clean = () => {
              clearTimeout(timer);
              off();
              offErr();
            };
            const off = resET.on(route, (e) => {
              if (e.headers.cid === cid && e.context.ws === ws) {
                clean();
                if (e.issues) {
                  reject(new SocketError(SocketError.InvalidResponse));
                  return;
                }
                resolve({ type: "Success", value: e.body.value });
              }
            });
            const offErr = errET.on(route, async (e) => {
              if (e.headers.cid === cid && e.context.ws === ws) {
                clean();
                if (e.issues) {
                  reject(new SocketError(SocketError.InvalidResponse));
                  return;
                }
                resolve({ type: "Failure", error: e.body.value });
              }
            });
            timer = setTimeout(() => {
              clean();
              reject(new SocketError(SocketError.RequestTimeout));
            }, t);
            const headers = this.#createHeaders(isClient, cid);
            if (!isClient || this.clientWS.ws?.readyState === 1) {
              this.#send({ method: "REQ", route, body: { value: data }, headers }, ws);
            } else {
              clean();
              reject(new SocketError(SocketError.ConnectionClosed));
            }
          });
        };
        if (isClient) return exec(this.clientWS.ws);
        const clients = Array.from(this.serverWS.ws.keys());
        if (options && "ws" in options) {
          const target = options.ws;
          if (typeof target === "function") {
            return exec(target(clients));
          }
          return exec(target);
        }
        return clients.map(exec);
      };

      reqET.on(route, async (e) => {
        if (e.issues) {
          this.#send(
            {
              method: "ERR",
              route,
              body: { value: e.issues },
              headers: this.#createHeaders(!isClient, e.headers.cid),
            },
            e.context.ws,
          );
          return;
        }
        const middlewares = middlewareMap[route] ?? [];
        if (middlewares.length === 0) return;

        const c = this.createRequestContext(route, e);
        try {
          let i = -1;
          const dispatch = async (idx: number): Promise<void> => {
            if (idx <= i) throw new Error("next() called multiple times");
            i = idx;
            const middleware = middlewares[idx];
            if (!middleware) return;
            const result = await middleware(c, () => dispatch(idx + 1));
            if (result !== undefined) c.res.body = result;
          };
          await dispatch(0);
          if (c.res.body === undefined) return;
          const headers = { ...c.res.header, ...this.#createHeaders(!isClient, e.headers.cid) };
          this.#send(
            { method: c.res.method, route, body: { value: c.res.body }, headers },
            e.context.ws,
          );
        } catch (error) {
          const isExpected = error instanceof SocketFailure;
          let failure: SocketFailure;
          if (isExpected) failure = error;
          else if (this.#onError) {
            const errCtx: SocketErrorHandlerContext = {
              error,
              req: c.req,
              res: { method: "ERR", route: c.res.route, header: c.res.header },
            };
            try {
              const errBody = await this.#onError(errCtx);
              const body = errBody !== undefined ? errBody : errCtx.res.body;
              failure = new SocketFailure(body);
            } catch {
              failure = new SocketFailure("InternalError");
            }
          } else {
            failure = new SocketFailure("InternalError");
          }
          const errSchema = (
            isClient ? this.#schemas.clientRequests : this.#schemas.serverRequests
          )?.[route]?.[2];
          if (isExpected) {
            const errValidation = await this.#validate(errSchema, failure.error, route, "ERR");
            if (!errValidation.success) failure = new SocketFailure("InternalError");
          }
          const headers = {
            ...c.res.header,
            ...this.#createHeaders(!isClient, e.headers.cid),
          };
          this.#send(
            { method: "ERR", route: c.res.route, body: { value: failure.error }, headers },
            e.context.ws,
          );
        }
      });

      api.handle[route] = (handler: SocketReqMiddleware<unknown, unknown>) => {
        const middlewares = middlewareMap[route];
        if (!middlewares) return () => undefined;
        middlewares.push(handler);
        return () => {
          const idx = middlewares.indexOf(handler);
          if (idx >= 0) middlewares.splice(idx, 1);
        };
      };
    });

    api.use = (
      matcher: SocketRequestMatcher<string>,
      handler: SocketReqMiddleware<unknown, unknown>,
    ) => {
      const predicate = this.#toPredicate(matcher);
      const offs = events.map((route) => {
        const register = api.handle[route];
        if (!register) return () => undefined;
        return register(async (c, next) => {
          if (!(await predicate(c))) return next();
          return handler(c, next);
        });
      });
      return () => offs.forEach((off) => off());
    };

    return api;
  }

  createOnMessage(isClient: boolean) {
    return async (e: MessageEvent, ws: WS) => {
      try {
        if (typeof e.data !== "string" || !e.data.startsWith(this.#prefix)) return;
        const p: SocketPacket = JSON.parse(e.data.slice(this.#prefix.length));
        if (isClient) this.#applySetCookie(p.headers?.["set-cookie"]);
        const {
          method,
          route,
          body: { value },
        } = p;
        const headers: SocketHeaders = p.headers ?? {};
        const cookie = this.#sanitizeCookie(headers.cookie);
        if (cookie) headers.cookie = cookie;
        else delete headers.cookie;
        const setCookie = this.#sanitizeCookie(headers["set-cookie"]);
        if (setCookie) headers["set-cookie"] = setCookie;
        else delete headers["set-cookie"];
        if ((method === "REQ" || method === "RES" || method === "ERR") && !headers.cid) return;
        const context: SocketContext = { ws };
        const body = { value };

        if (!isClient) {
          const clientData = this.serverWS.ws.get(ws);
          if (clientData) {
            clientData.meta.messageCount++;
            clientData.meta.lastMessageAt = Date.now();
          }
        }

        if (method === "PUSH") {
          const res = await this.#validate(
            (isClient ? this.#schemas.serverPushes : this.#schemas.clientPushes)?.[route],
            value,
            route,
            "PUSH",
          );
          if (res.success) {
            (isClient ? this.ets.sPush : this.ets.cPush).dispatchEvent(
              new SocketEvent(route, { value: res.value }, headers, context),
            );
          }
        } else if (method === "REQ") {
          const res = await this.#validate(
            (isClient ? this.#schemas.serverRequests : this.#schemas.clientRequests)?.[route]?.[0],
            value,
            route,
            "REQ",
          );
          (isClient ? this.ets.sReq : this.ets.cReq).dispatchEvent(
            new SocketEvent(
              route,
              res.success ? { value: res.value } : body,
              headers,
              context,
              res.success ? undefined : res.error,
            ),
          );
        } else if (method === "RES") {
          const res = await this.#validate(
            (isClient ? this.#schemas.clientRequests : this.#schemas.serverRequests)?.[route]?.[1],
            value,
            route,
            "RES",
          );
          (isClient ? this.ets.sRes : this.ets.cRes).dispatchEvent(
            new SocketEvent(
              route,
              res.success ? { value: res.value } : body,
              headers,
              context,
              res.success ? undefined : res.error,
            ),
          );
        } else if (method === "ERR") {
          const res = await this.#validate(
            (isClient ? this.#schemas.clientRequests : this.#schemas.serverRequests)?.[route]?.[2],
            value,
            route,
            "ERR",
          );
          (isClient ? this.ets.sErr : this.ets.cErr).dispatchEvent(
            new SocketEvent(
              route,
              res.success ? { value: res.value } : body,
              headers,
              context,
              res.success ? undefined : res.error,
            ),
          );
        }
      } catch {}
    };
  }
}

export {
  type StandardSchema,
  type StandardValidator,
  type ReqSchemaTuple,
  type Arg,
  SocketError,
  SocketFailure,
  type SocketResponse,
  type SocketHeaders,
  type SocketPushHandlerContext,
  type SocketReqHandlerContext,
  type SocketNext,
  type SocketPushHandler,
  type SocketReqMiddleware,
  type SocketRequestMatcher,
  type SocketBody,
  type SocketPacket,
  type WS,
  type SocketClientMeta,
  type SocketSchemas,
  type SocketErrorHandler,
  type SocketErrorHandlerContext,
  type RequestOption,
  type ServerRequestOption,
  type ServerRequestTargetOption,
  type ServerRequestTargetPicker,
  type ServerPushOption,
  type ServerPushTargetOption,
  type ServerPushTargetPicker,
  type SocketConstructOption,
  type PushSchemas,
  type ReqSchemas,
  defineSocketSchema,
  SocketCore,
};
