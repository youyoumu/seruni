import { type StandardSchemaV1 } from "@standard-schema/spec";

type StandardSchema = StandardSchemaV1;
type StandardValidator = Pick<StandardSchema, "~standard">;
type Infer<T extends StandardSchema> = StandardSchemaV1.InferOutput<T>;

type InferReq<T extends StandardSchema | undefined> = T extends StandardSchema
  ? StandardSchemaV1.InferOutput<T>
  : undefined;
type InferRes<T extends StandardSchema | undefined> = T extends StandardSchema
  ? StandardSchemaV1.InferOutput<T>
  : null;
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
type Arg<T1 = undefined, T2 = undefined, T3 = undefined> = undefined extends T1
  ? undefined extends T2
    ? undefined extends T3
      ? [arg1?: T1, arg2?: T2, arg3?: T3] // All optional
      : [arg1: T1 | undefined, arg2: T2 | undefined, arg3: T3] // T3 required
    : undefined extends T3
      ? [arg1: T1 | undefined, arg2: T2, arg3?: T3] // T2 required
      : [arg1: T1 | undefined, arg2: T2, arg3: T3] // T2 & T3 required
  : undefined extends T2
    ? undefined extends T3
      ? [arg1: T1, arg2?: T2, arg3?: T3] // Only T1 required
      : [arg1: T1, arg2: T2 | undefined, arg3: T3] // T1 & T3 required
    : undefined extends T3
      ? [arg1: T1, arg2: T2, arg3?: T3] // T1 & T2 required
      : [arg1: T1, arg2: T2, arg3: T3]; // All required

type KrissanErr =
  | typeof KrissanError.ConnectionClosed
  | typeof KrissanError.RequestTimeout
  | typeof KrissanError.InvalidResponse;
class KrissanError extends Error {
  static ConnectionClosed = "ConnectionClosed" as const;
  static RequestTimeout = "RequestTimeout" as const;
  static InvalidResponse = "InvalidResponse" as const;
  constructor(public readonly type: KrissanErr) {
    super();
    this.name = "KrissanError";
  }
}
class KrissanFailure {
  constructor(public readonly error: unknown) {}
}
/**
 * Represents the response from a socket request.
 * It can either be a Success with a value or a Failure with an error.
 */
type KrissanResponse<T = unknown, E = unknown> = [E] extends [never]
  ? { type: "Success"; value: T }
  : { type: "Success"; value: T } | { type: "Failure"; error: E };

/**
 * Container for the payload value in a socket packet.
 */
interface KrissanBody<T = unknown> {
  value?: T;
}

/**
 * Wire-level packet exchanged between client and server.
 */
interface KrissanPacket {
  method: "PUSH" | "REQ" | "RES" | "ERR";
  route: string;
  body: KrissanBody;
  headers?: KrissanHeaders;
}

/**
 * Protocol metadata for socket packets.
 */
interface KrissanHeaders {
  cid?: string;
  timestamp?: number;
  cookie?: Record<string, string>;
  "set-cookie"?: Record<string, string>;
}

/**
 * Context provided to request handlers.
 */
interface KrissanReqHandlerContext<TBody = unknown, TErr = unknown> {
  ws: WS;
  req: Readonly<{
    method: "REQ";
    route: string;
    body: TBody;
    headers: Readonly<KrissanHeaders>;
  }>;
  res: {
    method: "RES" | "ERR";
    route: string;
    header: KrissanHeaders;
    body?: unknown;
  };
  fail: (error: TErr) => never;
}

/**
 * Context provided to push handlers.
 */
interface KrissanPushHandlerContext<TBody = unknown> {
  ws: WS;
  push: Readonly<{
    method: "PUSH";
    route: string;
    body: TBody;
    headers: Readonly<KrissanHeaders>;
  }>;
}

/**
 * Continues to the next middleware in the chain.
 */
type KrissanNext = () => Promise<void>;

/**
 * Handler for push messages.
 */
type KrissanPushHandler<TBody = unknown> = (
  c: KrissanPushHandlerContext<TBody>,
) => void | Promise<void>;

/**
 * Middleware or handler for request messages.
 * Return a value to set the response body, or use `c.res.body`.
 */
type KrissanReqMiddleware<TReq = unknown, TRes = unknown, TErr = unknown> = (
  c: KrissanReqHandlerContext<TReq, TErr>,
  next: KrissanNext,
) => TRes | void | Promise<TRes | void>;

/**
 * Defines which routes a middleware should apply to.
 */
type KrissanRequestMatcher<Route extends string = string> =
  | Route
  | Route[]
  | RegExp
  | ((c: KrissanReqHandlerContext) => boolean | Promise<boolean>);

/**
 * Defines which routes a push handler should apply to.
 */
type KrissanPushMatcher<Route extends string = string> =
  | Route
  | Route[]
  | RegExp
  | ((c: KrissanPushHandlerContext) => boolean | Promise<boolean>);

/**
 * Metadata tracked for each connected client.
 */
interface KrissanClientMeta {
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
  [K in keyof T]: { req: InferReq<T[K][0]>; res: InferRes<T[K][1]>; err: InferErr<T[K][2]> };
};

/**
 * Schema definition for the socket communication.
 */
interface KrissanSchemas {
  /** Pushes initiated by the client */
  clientPushes: Record<string, StandardSchema>;
  /** Pushes initiated by the server */
  serverPushes: Record<string, StandardSchema>;
  /** Requests initiated by the client */
  clientRequests: Record<string, ReqSchemaTuple>;
  /** Requests initiated by the server */
  serverRequests: Record<string, ReqSchemaTuple>;
}

/**
 * Options for a single request.
 */
type RequestOption = { timeout?: number } | undefined;

/**
 * Options for a server-to-client request, allowing targeting specific clients.
 */
type ServerRequestTargetPicker =
  | undefined
  | ServerRequestTargetPickerSingle
  | ServerRequestTargetPickerMulti;
type ServerRequestTargetPickerSingle = WS | ((clients: WS[]) => WS);
type ServerRequestTargetPickerMulti = WS[] | ((clients: WS[]) => WS[]);

/**
 * Options for a server-to-client push, allowing targeting specific clients.
 */
type ServerPushTargetPicker = undefined | WS | WS[] | ((clients: WS[]) => WS | WS[] | undefined);

/**
 * Context provided to global error handlers.
 */
type KrissanErrorHandlerContext = {
  /** The request that caused the error */
  req: Readonly<{
    method: "REQ";
    route: string;
    headers: Readonly<KrissanHeaders>;
  }>;
  /** The error response being prepared */
  res: {
    method: "ERR";
    route: string;
    header: KrissanHeaders;
    body?: unknown;
  };
  /** The original error that occurred */
  error: unknown;
};

/**
 * Global error handler for unhandled exceptions in request processing.
 */
type KrissanErrorHandler<T = unknown> = (ctx: KrissanErrorHandlerContext) => T | Promise<T>;

/**
 * Options for constructing a socket.
 */
type KrissanConstructOption =
  | {
      /** Default timeout for requests in milliseconds */
      timeout?: number;
      /** Function to generate unique IDs for requests */
      uid?: () => string;
      /** Global error handler */
      onError?: KrissanErrorHandler;
      /** Protocol version ID to prevent cross-talk between different applications */
      protocolId?: number;
    }
  | undefined;

function defineKrissanSchema<T extends KrissanSchemas>(schema: T) {
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
const nullSchema: StandardValidator = {
  "~standard": {
    version: 1,
    vendor: "krissan",
    async validate(data: unknown) {
      if (data === null) return { value: null } as const;
      return { issues: [{ message: "Invalid input: expected null" }] } as const;
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

interface KrissanContext {
  ws: WS;
}

class KrissanEvent extends Event {
  constructor(
    type: string,
    public body: KrissanBody,
    public headers: KrissanHeaders = {},
    public context: KrissanContext,
    public issues?: unknown,
  ) {
    super(type);
  }
}

class ET extends EventTarget {
  on(
    route: string,
    handler: (packet: {
      body: KrissanBody;
      headers: KrissanHeaders;
      context: KrissanContext;
      issues?: unknown;
    }) => void,
  ) {
    const fn = (e: Event) =>
      e instanceof KrissanEvent &&
      handler({ body: e.body, headers: e.headers, context: e.context, issues: e.issues });
    this.addEventListener(route, fn);
    return () => this.removeEventListener(route, fn);
  }
}

class KrissanCore<const Schema extends KrissanSchemas, ClientState extends object = {}> {
  #schemas: Schema;
  #clientCookie: { value: Record<string, string> } = { value: {} };
  #uid: () => string;
  #onError?: KrissanErrorHandler;
  #protocolId: number;
  #prefix: string;
  readonly clientWS: { ws: WS | undefined } = { ws: undefined };
  readonly serverWS = { ws: new Map<WS, { meta: KrissanClientMeta } & ClientState>() };
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
      onError?: KrissanErrorHandler;
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
    schema: StandardSchema,
    data: unknown,
    route: string,
    method: KrissanPacket["method"],
  ) {
    const res = await schema["~standard"].validate(data);
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

  #createHeaders(isClientSender: boolean, cid?: string): KrissanHeaders {
    const headers: KrissanHeaders = { timestamp: Date.now() };
    if (cid) headers.cid = cid;
    if (isClientSender && Object.keys(this.#clientCookie.value).length > 0) {
      headers.cookie = this.#clientCookie.value;
    }
    return headers;
  }

  #toPredicate<T extends KrissanReqHandlerContext | KrissanPushHandlerContext>(
    matcher: string | string[] | RegExp | ((c: T) => boolean | Promise<boolean>),
    getRoute: (c: T) => string,
  ): (c: T) => boolean | Promise<boolean> {
    if (typeof matcher === "string") return (c) => getRoute(c) === matcher;
    if (Array.isArray(matcher)) return (c) => matcher.includes(getRoute(c));
    if (matcher instanceof RegExp) return (c) => matcher.test(getRoute(c));
    return matcher;
  }

  #send(payload: KrissanPacket, ws?: WS) {
    const data = `${this.#prefix}${JSON.stringify(payload)}`;
    if (ws) ws.send(data);
    else if (this.clientWS.ws?.readyState === 1) this.clientWS.ws.send(data);
    else this.serverWS.ws.forEach((_, s) => s.readyState === 1 && s.send(data));
  }

  createRequestContext(
    route: string,
    e: { body: KrissanBody; headers: KrissanHeaders; context: KrissanContext; issues?: unknown },
  ) {
    const res: KrissanReqHandlerContext["res"] = {
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
    const c: KrissanReqHandlerContext = {
      ws: e.context.ws,
      req: Object.freeze({
        method: "REQ" as const,
        route,
        body: e.body.value,
        headers: Object.freeze({ ...e.headers }),
      }),
      res,
      fail: (error: unknown): never => {
        throw new KrissanFailure(error);
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
      push: Partial<Record<string, (...args: Arg<unknown, ServerPushTargetPicker>) => void>>;
      handle: Partial<
        Record<string, (handler: (c: KrissanPushHandlerContext) => void) => () => void>
      >;
      use: (
        matcher: KrissanPushMatcher<string>,
        handler: (c: KrissanPushHandlerContext) => void,
      ) => () => void;
    } = { push: {}, handle: {}, use: () => () => undefined };
    events.forEach((route) => {
      api.push[route] = (...args) => {
        const data = args[0];
        const target = args[1];

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
        if (target) {
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
      api.handle[route] = (handler: (c: KrissanPushHandlerContext) => void) =>
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

    api.use = (
      matcher: KrissanPushMatcher<string>,
      handler: (c: KrissanPushHandlerContext) => void,
    ) => {
      const predicate = this.#toPredicate(matcher, (c) => c.push.route);
      const offs = events.map((route) => {
        const register = api.handle[route];
        if (!register) return () => undefined;
        return register(async (c) => {
          if (!(await predicate(c))) return;
          return handler(c);
        });
      });
      return () => offs.forEach((off) => off());
    };

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
      request: Partial<
        Record<string, (...args: Arg<unknown, RequestOption, ServerRequestTargetPicker>) => unknown>
      >;
      handle: Partial<Record<string, (handler: KrissanReqMiddleware) => () => void>>;
      use: (matcher: KrissanRequestMatcher<string>, handler: KrissanReqMiddleware) => () => void;
    } = {
      request: {},
      handle: {},
      use: () => () => undefined,
    };
    const middlewareMap: Partial<Record<string, KrissanReqMiddleware[]>> = {};

    events.forEach((route) => {
      middlewareMap[route] = [];
      api.request[route] = (...args) => {
        const data = args[0];
        const options = args[1];
        const target = args[2];
        const cid = this.#uid();
        const t = options?.timeout ?? timeout;
        const exec = (ws?: WS): Promise<KrissanResponse> => {
          return new Promise((resolve, reject) => {
            if (!ws) return reject(new KrissanError(KrissanError.ConnectionClosed));
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
                  reject(new KrissanError(KrissanError.InvalidResponse));
                  return;
                }
                resolve({ type: "Success", value: e.body.value });
              }
            });
            const offErr = errET.on(route, async (e) => {
              if (e.headers.cid === cid && e.context.ws === ws) {
                clean();
                if (e.issues) {
                  reject(new KrissanError(KrissanError.InvalidResponse));
                  return;
                }
                resolve({ type: "Failure", error: e.body.value });
              }
            });
            timer = setTimeout(() => {
              clean();
              reject(new KrissanError(KrissanError.RequestTimeout));
            }, t);
            const headers = this.#createHeaders(isClient, cid);
            if (!isClient || this.clientWS.ws?.readyState === 1) {
              this.#send({ method: "REQ", route, body: { value: data }, headers }, ws);
            } else {
              clean();
              reject(new KrissanError(KrissanError.ConnectionClosed));
            }
          });
        };
        if (isClient) return exec(this.clientWS.ws);
        const clients = Array.from(this.serverWS.ws.keys());
        if (target) {
          if (Array.isArray(target)) return target.map(exec);
          if (typeof target === "function") {
            const picked = target(clients);
            if (Array.isArray(picked)) return picked.map(exec);
            return exec(picked);
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
          const isExpected = error instanceof KrissanFailure;
          let failure: KrissanFailure;
          if (isExpected) failure = error;
          else if (this.#onError) {
            const errCtx: KrissanErrorHandlerContext = {
              error,
              req: c.req,
              res: { method: "ERR", route: c.res.route, header: c.res.header },
            };
            try {
              const errBody = await this.#onError(errCtx);
              const body = errBody !== undefined ? errBody : errCtx.res.body;
              failure = new KrissanFailure(body);
            } catch {
              failure = new KrissanFailure("InternalError");
            }
          } else {
            failure = new KrissanFailure("InternalError");
          }
          const errSchema =
            (isClient ? this.#schemas.clientRequests : this.#schemas.serverRequests)?.[
              route
            ]?.[2] ?? neverSchema;
          if (isExpected) {
            const errValidation = await this.#validate(errSchema, failure.error, route, "ERR");
            if (!errValidation.success) failure = new KrissanFailure("InternalError");
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

      api.handle[route] = (handler: KrissanReqMiddleware) => {
        const middlewares = middlewareMap[route];
        if (!middlewares) return () => undefined;
        middlewares.push(handler);
        return () => {
          const idx = middlewares.indexOf(handler);
          if (idx >= 0) middlewares.splice(idx, 1);
        };
      };
    });

    api.use = (matcher: KrissanRequestMatcher<string>, handler: KrissanReqMiddleware) => {
      const predicate = this.#toPredicate(matcher, (c) => c.req.route);
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
        const p: KrissanPacket = JSON.parse(e.data.slice(this.#prefix.length));
        if (isClient) this.#applySetCookie(p.headers?.["set-cookie"]);
        const {
          method,
          route,
          body: { value },
        } = p;
        const headers: KrissanHeaders = p.headers ?? {};
        const cookie = this.#sanitizeCookie(headers.cookie);
        if (cookie) headers.cookie = cookie;
        else delete headers.cookie;
        const setCookie = this.#sanitizeCookie(headers["set-cookie"]);
        if (setCookie) headers["set-cookie"] = setCookie;
        else delete headers["set-cookie"];
        if ((method === "REQ" || method === "RES" || method === "ERR") && !headers.cid) return;
        const context: KrissanContext = { ws };
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
            (isClient ? this.#schemas.serverPushes : this.#schemas.clientPushes)?.[route] ??
              undefinedSchema,
            value,
            route,
            "PUSH",
          );
          if (res.success) {
            (isClient ? this.ets.sPush : this.ets.cPush).dispatchEvent(
              new KrissanEvent(route, { value: res.value }, headers, context),
            );
          }
        } else if (method === "REQ") {
          const res = await this.#validate(
            (isClient ? this.#schemas.serverRequests : this.#schemas.clientRequests)?.[
              route
            ]?.[0] ?? undefinedSchema,
            value,
            route,
            "REQ",
          );
          (isClient ? this.ets.sReq : this.ets.cReq).dispatchEvent(
            new KrissanEvent(
              route,
              res.success ? { value: res.value } : body,
              headers,
              context,
              res.success ? undefined : res.error,
            ),
          );
        } else if (method === "RES") {
          const res = await this.#validate(
            (isClient ? this.#schemas.clientRequests : this.#schemas.serverRequests)?.[
              route
            ]?.[1] ?? nullSchema,
            value,
            route,
            "RES",
          );
          (isClient ? this.ets.sRes : this.ets.cRes).dispatchEvent(
            new KrissanEvent(
              route,
              res.success ? { value: res.value } : body,
              headers,
              context,
              res.success ? undefined : res.error,
            ),
          );
        } else if (method === "ERR") {
          const res = await this.#validate(
            (isClient ? this.#schemas.clientRequests : this.#schemas.serverRequests)?.[
              route
            ]?.[2] ?? neverSchema,
            value,
            route,
            "ERR",
          );
          (isClient ? this.ets.sErr : this.ets.cErr).dispatchEvent(
            new KrissanEvent(
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
  KrissanError,
  KrissanFailure,
  type KrissanResponse,
  type KrissanHeaders,
  type KrissanPushHandlerContext,
  type KrissanReqHandlerContext,
  type KrissanNext,
  type KrissanPushHandler,
  type KrissanReqMiddleware,
  type KrissanRequestMatcher,
  type KrissanPushMatcher,
  type KrissanBody,
  type KrissanPacket,
  type WS,
  type KrissanClientMeta,
  type KrissanSchemas,
  type KrissanErrorHandler,
  type KrissanErrorHandlerContext,
  type RequestOption,
  type ServerRequestTargetPicker,
  type ServerRequestTargetPickerSingle,
  type ServerRequestTargetPickerMulti,
  type ServerPushTargetPicker,
  type KrissanConstructOption,
  type PushSchemas,
  type ReqSchemas,
  defineKrissanSchema,
  KrissanCore,
};
