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

const PUSH = "PUSH" as const;
const REQ = "REQ" as const;
const RES = "RES" as const;
const ERR = "ERR" as const;

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
type KrissanBody<T = unknown> = T;

/**
 * Wire-level packet exchanged between client and server.
 */
interface KrissanPacket {
  method: typeof PUSH | typeof REQ | typeof RES | typeof ERR;
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
interface KrissanReqHandlerContext<TBody = unknown, TErr = unknown, TState = unknown> {
  ws: WS;
  req: Readonly<{
    method: typeof REQ;
    route: string;
    body: TBody;
    headers: Readonly<KrissanHeaders>;
  }>;
  res: {
    method: typeof RES | typeof ERR;
    route: string;
    headers: KrissanHeaders;
    body?: unknown;
  };
  state: TState;
  setState: (state: Record<string, unknown>) => void;
  fail: (error: TErr) => never;
}

/**
 * Context provided to push handlers.
 */
interface KrissanPushHandlerContext<TBody = unknown, TState = unknown> {
  ws: WS;
  push: Readonly<{
    method: typeof PUSH;
    route: string;
    body: TBody;
    headers: Readonly<KrissanHeaders>;
  }>;
  state: TState;
  setState: (state: Record<string, unknown>) => void;
}

/**
 * Continues to the next middleware in the chain.
 */
type KrissanNext = () => Promise<void>;

/**
 * Handler for push messages.
 */
type KrissanPushHandler<TBody = unknown, TState = unknown> = (
  c: KrissanPushHandlerContext<TBody, TState>,
) => void | Promise<void>;

/**
 * Middleware or handler for request messages.
 * Return a value to set the response body, or use `c.res.body`.
 */
type KrissanReqMiddleware<TReq = unknown, TRes = unknown, TErr = unknown, TState = unknown> = (
  c: KrissanReqHandlerContext<TReq, TErr, TState>,
  next: KrissanNext,
) => TRes | void | Promise<TRes | void>;

/**
 * Defines which routes a middleware should apply to.
 */
type KrissanRequestMatcher<Route extends string = string, TState = unknown> =
  | Route
  | Route[]
  | RegExp
  | ((c: KrissanReqHandlerContext<unknown, unknown, TState>) => boolean | Promise<boolean>);

/**
 * Defines which routes a push handler should apply to.
 */
type KrissanPushMatcher<Route extends string = string, TState = unknown> =
  | Route
  | Route[]
  | RegExp
  | ((c: KrissanPushHandlerContext<unknown, TState>) => boolean | Promise<boolean>);

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
    method: typeof REQ;
    route: string;
    headers: Readonly<KrissanHeaders>;
  }>;
  /** The error response being prepared */
  res: {
    method: typeof ERR;
    route: string;
    headers: KrissanHeaders;
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
      defaultTimeout?: number;
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

const def = Object.defineProperty;
const frz = Object.freeze;
const createValidator = (v: StandardValidator["~standard"]["validate"]): StandardValidator => ({
  "~standard": { version: 1, vendor: "krissan", validate: v },
});

const noop = () => {};
const uid = () => Math.random().toString(36).slice(2);
const DEFAULT_PROTOCOL_ID = 16777619;
const DEFAULT_TIMEOUT = 300000;
const undefinedSchema = createValidator(async (data: unknown) => {
  if (data === undefined) return { value: undefined } as const;
  return { issues: [{ message: "Invalid input: expected undefined" }] } as const;
});
const nullSchema = createValidator(async (data: unknown) => {
  if (data === null) return { value: null } as const;
  return { issues: [{ message: "Invalid input: expected null" }] } as const;
});
const neverSchema = createValidator(async (_data: unknown) => {
  return { issues: [{ message: "Invalid input: expected never" }] } as const;
});

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

abstract class KrissanBase<const Schema extends KrissanSchemas, State = unknown> {
  protected schemas: Schema;
  protected uid: () => string;
  protected onError?: KrissanErrorHandler;
  protected protocolId: number;
  protected prefix: string;
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
  protected defaultTimeout: number;

  constructor(
    schemas: Schema,
    options?: {
      defaultTimeout?: number;
      uid?: () => string;
      onError?: KrissanErrorHandler;
      protocolId?: number;
    },
  ) {
    this.schemas = schemas;
    this.uid = options?.uid ?? uid;
    this.onError = options?.onError;
    this.defaultTimeout = options?.defaultTimeout ?? DEFAULT_TIMEOUT;
    this.protocolId = options?.protocolId ?? DEFAULT_PROTOCOL_ID;
    this.prefix = `krissan:${this.protocolId}:`;
  }

  protected sanitizeCookie(cookie: unknown): Record<string, string> | undefined {
    if (!cookie || typeof cookie !== "object" || Array.isArray(cookie)) return undefined;
    const sanitized: Record<string, string> = {};
    Object.entries(cookie).forEach(([k, v]) => {
      if (typeof v === "string") sanitized[k] = v;
    });
    return sanitized;
  }

  protected async validate(
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

  protected async emit(
    et: ET,
    schema: StandardSchema,
    body: unknown,
    route: string,
    method: KrissanPacket["method"],
    headers: KrissanHeaders,
    context: KrissanContext,
  ) {
    const res = await this.validate(schema, body, route, method);
    if (method === PUSH && !res.success) return;
    const success = res.success;
    et.dispatchEvent(
      new KrissanEvent(
        route,
        success ? res.value : body,
        headers,
        context,
        success ? undefined : res.error,
      ),
    );
  }

  protected abstract createHeaders(cid?: string): KrissanHeaders;

  protected toPredicate<T extends KrissanReqHandlerContext | KrissanPushHandlerContext>(
    matcher: string | string[] | RegExp | ((c: T) => boolean | Promise<boolean>),
    getRoute: (c: T) => string,
  ): (c: T) => boolean | Promise<boolean> {
    if (typeof matcher === "string") return (c) => getRoute(c) === matcher;
    if (Array.isArray(matcher)) return (c) => matcher.includes(getRoute(c));
    if (matcher instanceof RegExp) return (c) => matcher.test(getRoute(c));
    return matcher;
  }

  protected abstract send(payload: KrissanPacket, ws?: WS): void;

  protected abstract getState(ws: WS): State | undefined;

  protected createReqContext(
    route: string,
    e: { body: KrissanBody; headers: KrissanHeaders; context: KrissanContext; issues?: unknown },
  ) {
    const ws = e.context.ws;
    const state = this.getState(ws);
    const res: KrissanReqHandlerContext["res"] = {
      method: RES,
      route,
      headers: {},
    };
    def(res, "method", { value: RES, enumerable: true });
    def(res, "route", { value: route, enumerable: true });
    const c: KrissanReqHandlerContext<unknown, unknown, State | undefined> = {
      ws,
      state,
      setState: (newState: Record<string, unknown>) => {
        if (state && typeof state === "object") Object.assign(state, newState);
      },
      req: frz({
        method: REQ,
        route,
        body: e.body,
        headers: frz({ ...e.headers }),
      }),
      res,
      fail: (error: unknown): never => {
        throw new KrissanFailure(error);
      },
    };
    return c;
  }

  protected createPushContext(
    route: string,
    e: { body: KrissanBody; headers: KrissanHeaders; context: KrissanContext; issues?: unknown },
  ) {
    const ws = e.context.ws;
    const state = this.getState(ws);
    return {
      ws,
      state: state,
      setState: (newState: Record<string, unknown>) => {
        if (state && typeof state === "object") Object.assign(state, newState);
      },
      push: frz({
        method: PUSH,
        route,
        body: e.body,
        headers: frz({ ...e.headers }),
      }),
    };
  }

  protected createErrContext(
    error: unknown,
    req: KrissanReqHandlerContext["req"],
    headers: KrissanHeaders,
  ): KrissanErrorHandlerContext {
    return { error, req, res: { method: ERR, route: req.route, headers } };
  }

  protected createPushApi<TTarget = unknown>(
    events: readonly string[],
    sender: (route: string, data: unknown, target?: TTarget) => void,
  ) {
    type PushAPI = Record<string, (...args: Arg<unknown, TTarget>) => void>;
    const api: { push: PushAPI } = { push: {} };

    for (const route of events) {
      api.push[route] = (...args: Arg<unknown, TTarget>) => {
        const [data, target] = args;
        sender(route, data, target);
      };
    }

    return api;
  }

  protected createPushHandler(events: readonly string[], reverseET: ET) {
    type Handler = (c: KrissanPushHandlerContext<unknown, State | undefined>) => void;
    type HandleAPI = Record<string, (handler: Handler) => () => void>;
    type Matcher = KrissanPushMatcher<string, State | undefined>;
    type UseAPI = (matcher: Matcher, handler: Handler) => () => void;
    const api: { handle: HandleAPI; use: UseAPI } = { handle: {}, use: () => () => undefined };

    for (const route of events) {
      api.handle[route] = (handler: Handler) => {
        return reverseET.on(route, (e) => {
          const c = this.createPushContext(route, e);
          handler(c);
        });
      };
    }

    api.use = (matcher: Matcher, handler: Handler) => {
      const predicate = this.toPredicate(matcher, (c) => c.push.route);
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

  protected async decideFailure(
    c: KrissanReqHandlerContext,
    error: unknown,
    route: string,
    reqSchemas?: Record<string, ReqSchemaTuple>,
  ): Promise<KrissanFailure> {
    const isExpected = error instanceof KrissanFailure;
    let failure: KrissanFailure;
    if (isExpected) failure = error;
    else if (this.onError) {
      const errCtx = this.createErrContext(error, c.req, c.res.headers);
      try {
        const errBody = await this.onError(errCtx);
        const body = errBody !== undefined ? errBody : errCtx.res.body;
        failure = new KrissanFailure(body);
      } catch {
        failure = new KrissanFailure("InternalError");
      }
    } else failure = new KrissanFailure("InternalError");
    const schema = reqSchemas?.[route]?.[2] ?? neverSchema;
    if (isExpected) {
      const validation = await this.validate(schema, failure.error, route, ERR);
      if (!validation.success) failure = new KrissanFailure("InternalError");
    }
    return failure;
  }

  protected createReqApi<TTarget = unknown>(
    events: readonly string[],
    requestSender: (
      route: string,
      cid: string,
      data: unknown,
      timeout: number,
      target?: TTarget,
    ) => unknown,
  ) {
    type RequestAPI = Record<string, (...args: Arg<unknown, RequestOption, TTarget>) => unknown>;
    const api: { request: RequestAPI } = { request: {} };

    for (const route of events) {
      api.request[route] = (...args: Arg<unknown, RequestOption, TTarget>) => {
        const [data, options, target] = args;
        const cid = this.uid();
        const t = options?.timeout ?? this.defaultTimeout;
        return requestSender(route, cid, data, t, target);
      };
    }

    return api;
  }

  protected createRequestHandler(
    events: readonly string[],
    reqET: ET,
    reqSchemas?: Record<string, ReqSchemaTuple>,
  ) {
    type Handler = KrissanReqMiddleware<unknown, unknown, unknown, State | undefined>;
    type HandleAPI = Record<string, (handler: Handler) => () => void>;
    type Matcher = KrissanRequestMatcher<string, State | undefined>;
    type UseAPI = (matcher: Matcher, handler: Handler) => () => void;
    const api: { handle: HandleAPI; use: UseAPI } = { handle: {}, use: () => () => undefined };
    const middlewareMap: Partial<Record<string, Handler[]>> = {};

    for (const route of events) {
      middlewareMap[route] = [];

      reqET.on(route, async (e) => {
        if (e.issues) {
          const headers = this.createHeaders(e.headers.cid);
          const payload = { method: ERR, route, body: e.issues, headers };
          return this.send(payload, e.context.ws);
        }

        const middlewares = middlewareMap[route] ?? [];
        if (middlewares.length === 0) return;

        const c = this.createReqContext(route, e);
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
          const headers = { ...c.res.headers, ...this.createHeaders(e.headers.cid) };
          const payload = { method: c.res.method, route, body: c.res.body, headers };
          this.send(payload, e.context.ws);
        } catch (error) {
          const failure = await this.decideFailure(c, error, route, reqSchemas);
          const headers = { ...c.res.headers, ...this.createHeaders(e.headers.cid) };
          this.send(
            { method: ERR, route: c.res.route, body: failure.error, headers },
            e.context.ws,
          );
        }
      });

      api.handle[route] = (handler: Handler) => {
        const middlewares = middlewareMap[route];
        if (!middlewares) return () => undefined;
        middlewares.push(handler);
        return () => {
          const idx = middlewares.indexOf(handler);
          if (idx >= 0) middlewares.splice(idx, 1);
        };
      };
    }

    api.use = (matcher: Matcher, handler: Handler) => {
      const predicate = this.toPredicate(matcher, (c) => c.req.route);
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
}

export {
  type StandardSchema,
  type StandardValidator,
  type ReqSchemaTuple,
  type Arg,
  PUSH,
  REQ,
  RES,
  ERR,
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
  type KrissanContext,
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
  KrissanBase,
  KrissanEvent,
  ET,
  noop,
  undefinedSchema,
  nullSchema,
  neverSchema,
};
