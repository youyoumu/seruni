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
type ReqSchemaTuple = [
  (StandardSchema | undefined)?,
  (StandardSchema | undefined)?,
  (StandardSchema | undefined)?,
];
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
  constructor(
    public readonly error: unknown,
    public readonly headers?: SocketHeaders,
  ) {}
}
type SocketResponse<T = unknown, E = unknown> = [E] extends [never]
  ? { type: "Success"; value: T }
  : { type: "Success"; value: T } | { type: "Failure"; error: E };

interface SocketBody<T = unknown> {
  value?: T;
}

/**
 * Wire-level packet exchanged between client and server.
 * - `method`: packet intent
 * - `route`: schema key/route name
 * - `body`: validated payload container
 * - `headers`: protocol metadata (correlation/cookie/timestamp)
 */
interface SocketPacket {
  method: "PUSH" | "REQ" | "RES" | "ERR";
  route: string;
  body: SocketBody;
  headers?: SocketHeaders;
}
interface SocketHeaders {
  cid?: string;
  timestamp?: number;
  cookie?: Record<string, string>;
  "set-cookie"?: Record<string, string>;
}
interface SocketReqHandlerContext<TBody = unknown, TErr = unknown> {
  ws: WS;
  req: Readonly<{
    method: "REQ";
    route: string;
    body: TBody;
    headers: Readonly<SocketHeaders>;
  }>;
  res: {
    method: "RES" | "ERR";
    route: string;
    header: SocketHeaders;
    body?: unknown;
  };
  fail: (error: TErr, headers?: SocketHeaders) => never;
}
interface SocketPushHandlerContext<TBody = unknown> {
  ws: WS;
  push: Readonly<{
    method: "PUSH";
    route: string;
    body: TBody;
    headers: Readonly<SocketHeaders>;
  }>;
}
type SocketNext = () => Promise<void>;
type SocketPushHandler<TBody = unknown> = (
  c: SocketPushHandlerContext<TBody>,
) => void | Promise<void>;
type SocketReqMiddleware<TReq = unknown, TRes = unknown, TErr = unknown> = (
  c: SocketReqHandlerContext<TReq, TErr>,
  next: SocketNext,
) => TRes | void | Promise<TRes | void>;
type SocketRequestMatcher<Route extends string> =
  | Route
  | Route[]
  | RegExp
  | ((c: SocketReqHandlerContext<unknown>) => boolean | Promise<boolean>);
interface SocketClientMeta {
  readonly connectedAt: number;
  messageCount: number;
  lastMessageAt: number | null;
}
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
interface SocketSchemas {
  clientPushes: Record<string, StandardSchema>;
  serverPushes: Record<string, StandardSchema>;
  clientRequests: Record<string, ReqSchemaTuple>;
  serverRequests: Record<string, ReqSchemaTuple>;
}

type ServerTargetPicker = (clients: WS[]) => WS | undefined;

type RequestOption = { timeout?: number } | undefined;
type ServerRequestTargetOption =
  | ({ timeout?: number } & { ws: WS; pick?: undefined })
  | ({ timeout?: number } & { pick: ServerTargetPicker; ws?: undefined });
type ServerRequestOption = RequestOption | ServerRequestTargetOption;
type SocketErrorHandlerContext = {
  req: Readonly<{
    method: "REQ";
    route: string;
    headers: Readonly<SocketHeaders>;
  }>;
  res: {
    method: "ERR";
    route: string;
    header: SocketHeaders;
    body?: unknown;
  };
  error: unknown;
};
type SocketErrorHandler<T = unknown> = (ctx: SocketErrorHandlerContext) => T | Promise<T>;
type SocketConstructOption =
  | {
      timeout?: number;
      uid?: () => string;
      onError?: SocketErrorHandler;
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

  #send(payload: SocketPacket, ws?: WS) {
    const data = `${this.#prefix}${JSON.stringify(payload)}`;
    if (ws) ws.send(data);
    else if (this.clientWS.ws?.readyState === 1) this.clientWS.ws.send(data);
    else this.serverWS.ws.forEach((_, s) => s.readyState === 1 && s.send(data));
  }

  createPushLane(events: string[], reverseET: ET, isClient: boolean) {
    const api: {
      push: Record<string, (...data: unknown[]) => void>;
      handle: Record<
        string,
        (handler: (c: SocketPushHandlerContext<unknown>) => void) => () => void
      >;
    } = { push: {}, handle: {} };
    events.forEach((route) => {
      api.push[route] = (data: unknown) => {
        this.#send({
          method: "PUSH",
          route,
          body: { value: data },
          headers: this.#createHeaders(isClient),
        });
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
    const toPredicate = (
      matcher: SocketRequestMatcher<string>,
    ): ((c: SocketReqHandlerContext<unknown>) => boolean | Promise<boolean>) => {
      if (typeof matcher === "string") return (c) => c.req.route === matcher;
      if (Array.isArray(matcher)) return (c) => matcher.includes(c.req.route);
      if (matcher instanceof RegExp) return (c) => matcher.test(c.req.route);
      return matcher;
    };

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
        if (options && "ws" in options) return exec(options.ws);
        const clients = Array.from(this.serverWS.ws.keys());
        if (options && "pick" in options) return exec(options.pick(clients));
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
        const fail = (error: unknown, headers?: SocketHeaders): never => {
          throw new SocketFailure(error, headers);
        };
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
          fail,
        };
        const middlewares = middlewareMap[route] ?? [];
        if (middlewares.length === 0) return;
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
              res: {
                method: "ERR",
                route: c.res.route,
                header: c.res.header,
              },
            };
            try {
              const errBody = await this.#onError(errCtx);
              const body = errBody !== undefined ? errBody : errCtx.res.body;
              failure = new SocketFailure(body, errCtx.res.header);
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
            ...failure.headers,
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
      const predicate = toPredicate(matcher);
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
  type SocketConstructOption,
  type PushSchemas,
  type ReqSchemas,
  defineSocketSchema,
  SocketCore,
};
