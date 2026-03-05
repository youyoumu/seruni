import { type StandardSchemaV1 } from "@standard-schema/spec";

type StandardSchema = StandardSchemaV1;
type Infer<T extends StandardSchema> = StandardSchemaV1.InferOutput<T>;
type Arg<T1, T2 = undefined> = undefined extends T1
  ? undefined extends T2
    ? [arg1?: T1, arg2?: T2]
    : [arg1: T1 | undefined, arg2: T2]
  : undefined extends T2
    ? [arg1: T1, arg2?: T2]
    : [arg1: T1, arg2: T2];

const uid = () => Math.random().toString(36).slice(2);

enum SocketErr {
  Closed,
  Timeout,
}
class SocketError extends Error {
  static ConnectionClosed = SocketErr.Closed;
  static RequestTimeout = SocketErr.Timeout;
  constructor(public readonly type: SocketErr) {
    super();
    this.name = "SocketError";
  }
}

interface SocketBody<T = unknown> {
  value: T;
}
interface SocketPacket {
  "sock.et": typeof SOCKET_MAGIC_NUMBER;
  method: "PUSH" | "REQUEST" | "RESPONSE";
  name: string;
  body: SocketBody;
  headers?: SocketHeaders;
}
type SocketPacketPayload = Omit<SocketPacket, "sock.et">;
interface SocketHeaders {
  cid?: string;
  timestamp?: number;
  state?: string;
  "set-state"?: string;
}
interface WS {
  send: (data: string) => void;
  readyState: WebSocket["readyState"];
}
interface SocketContext {
  ws?: WS;
}

const SOCKET_MAGIC_NUMBER = 16777619;
const DEFAULT_TIMEOUT = 300000;

class SocketEvent extends Event {
  constructor(
    type: string,
    public body: SocketBody,
    public headers: SocketHeaders = {},
    public context: SocketContext = {},
  ) {
    super(type);
  }
}

class Bus extends EventTarget {
  on(
    name: string,
    handler: (packet: { body: SocketBody; headers: SocketHeaders; context: SocketContext }) => void,
  ) {
    const fn = (e: Event) =>
      e instanceof SocketEvent && handler({ body: e.body, headers: e.headers, context: e.context });
    this.addEventListener(name, fn);
    return () => this.removeEventListener(name, fn);
  }
}

type PushSchemas<T extends Record<string, StandardSchema>> = {
  [K in keyof T]: { push: Infer<T[K]> };
};
type ReqSchemas<T extends Record<string, [StandardSchema, StandardSchema]>> = {
  [K in keyof T]: { req: Infer<T[K][0]>; res: Infer<T[K][1]> };
};
interface SocketSchemas {
  clientPushes: Record<string, StandardSchema>;
  serverPushes: Record<string, StandardSchema>;
  clientRequests: Record<string, [StandardSchema, StandardSchema]>;
  serverRequests: Record<string, [StandardSchema, StandardSchema]>;
}

type RequestOption = { timeout?: number } | undefined;

function defineSocketSchema<T extends SocketSchemas>(schema: T) {
  return schema;
}

function createSocket<const Schema extends SocketSchemas>(
  schemas: Schema,
  options?: { clientTimeout?: number; serverTimeout?: number },
) {
  type CPush = PushSchemas<NonNullable<Schema["clientPushes"]>>;
  type SPush = PushSchemas<NonNullable<Schema["serverPushes"]>>;
  type CReq = ReqSchemas<NonNullable<Schema["clientRequests"]>>;
  type SReq = ReqSchemas<NonNullable<Schema["serverRequests"]>>;

  const clientWS: { ws: WS | undefined } = { ws: undefined };
  const clientState = { value: "" };
  const serverWS = { ws: new Set<WS>() };
  const buses = {
    cPush: new Bus(),
    sPush: new Bus(),
    cReq: new Bus(),
    sReq: new Bus(),
    cRes: new Bus(),
    sRes: new Bus(),
  };

  const applySetHeader = (setHeader?: string) => {
    if (setHeader === undefined) return;
    clientState.value = setHeader;
  };

  const createHeaders = (isClientSender: boolean, cid?: string): SocketHeaders => {
    const timestamp = Date.now();
    const headers: SocketHeaders = { timestamp };
    if (cid) headers.cid = cid;
    if (isClientSender && clientState.value.length > 0) {
      headers.state = clientState.value;
    }
    return headers;
  };

  const send = (payload: SocketPacketPayload, ws?: WS) => {
    const packet: SocketPacket = { "sock.et": SOCKET_MAGIC_NUMBER, ...payload };
    const data = JSON.stringify(packet);
    if (ws) ws.send(data);
    else if (clientWS.ws?.readyState === 1) clientWS.ws.send(data);
    else serverWS.ws.forEach((s) => s.readyState === 1 && s.send(data));
  };

  const setupPush = (names: string[], bus: Bus, reverseBus: Bus, isClient: boolean) => {
    const api: {
      push: Record<string, (...data: unknown[]) => void>;
      handle: Record<
        string,
        (handler: (data: unknown, headers: SocketHeaders) => void) => () => void
      >;
    } = {
      push: {},
      handle: {},
    };
    names.forEach((name) => {
      api.push[name] = (data: unknown) => {
        const body = { value: data };
        bus.dispatchEvent(new SocketEvent(name, body));
        send({
          method: "PUSH",
          name,
          body,
          headers: createHeaders(isClient),
        });
      };
      api.handle[name] = (handler: (data: unknown, headers: SocketHeaders) => void) =>
        reverseBus.on(name, (e) => handler(e.body.value, e.headers));
    });
    return api;
  };

  const setupReq = (
    names: string[],
    reqBus: Bus,
    resBus: Bus,
    timeout: number,
    isClient: boolean,
  ) => {
    const api: {
      request: Record<
        string,
        (...args: Arg<unknown, RequestOption>) => Promise<unknown> | Promise<unknown>[]
      >;
      handle: Record<
        string,
        (handler: (data: unknown, headers: SocketHeaders) => unknown) => () => void
      >;
    } = { request: {}, handle: {} };

    names.forEach((name) => {
      api.request[name] = (...args) => {
        const data = args[0],
          cid = uid(),
          t = args[1]?.timeout ?? timeout;

        const exec = (ws?: WS): Promise<unknown> =>
          new Promise((resolve, reject) => {
            let timer: ReturnType<typeof setTimeout>;
            const clean = () => {
              clearTimeout(timer);
              off();
              offErr();
            };
            const off = resBus.on(name, (e) => {
              if (e.headers.cid === cid && (!ws || e.context.ws === ws)) {
                clean();
                resolve(e.body.value);
              }
            });
            const offErr = resBus.on("__error__", (e) => {
              if (e.headers.cid === cid && (!ws || e.context.ws === ws)) {
                clean();
                reject(e.body.value);
              }
            });
            timer = setTimeout(() => {
              clean();
              reject(new SocketError(SocketError.RequestTimeout));
            }, t);
            const body = { value: data };
            const headers = createHeaders(isClient, cid);
            reqBus.dispatchEvent(new SocketEvent(name, body, headers, { ws }));
            if (!isClient || clientWS.ws?.readyState === 1) {
              send(
                {
                  method: "REQUEST",
                  name,
                  body,
                  headers,
                },
                ws,
              );
            } else {
              resBus.dispatchEvent(
                new SocketEvent(
                  "__error__",
                  {
                    value: new SocketError(SocketError.ConnectionClosed),
                  },
                  { cid },
                ),
              );
            }
          });
        return isClient ? exec() : Array.from(serverWS.ws).map(exec);
      };
      api.handle[name] = (handler: (data: unknown, headers: SocketHeaders) => unknown) =>
        reqBus.on(name, async (e) => {
          const result = await handler(e.body.value, e.headers);
          const body = { value: result };
          const headers = createHeaders(!isClient, e.headers.cid);
          resBus.dispatchEvent(new SocketEvent(name, body, headers, e.context));
          send(
            {
              method: "RESPONSE",
              name,
              body,
              headers,
            },
            e.context.ws,
          );
        });
    });
    return api;
  };

  const validate = async (
    schema: StandardSchema | undefined,
    data: unknown,
    name: string,
    type: string,
  ) => {
    if (!schema) throw new Error(`No schema for ${type} [${name}]`);
    const res = await schema["~standard"].validate(data);
    if ("issues" in res) {
      console.error(`Validation failed for ${type} [${name}]`, res.issues);
      return { success: false as const };
    }
    return { success: true as const, value: res.value };
  };

  const onMessage = (isClient: boolean) => async (e: MessageEvent, ws_?: WS) => {
    try {
      const p = JSON.parse(e.data);
      if (p["sock.et"] !== SOCKET_MAGIC_NUMBER) return;
      if (isClient) applySetHeader(p.headers?.["set-state"]);
      const {
        method,
        name,
        body: { value },
      } = p;
      const headers = p.headers ?? {};
      if ((method === "REQUEST" || method === "RESPONSE") && !headers.cid) return;
      const ws = isClient ? undefined : ws_;
      const body = { value };
      const context = { ws };

      if (method === "PUSH") {
        const res = await validate(
          (isClient ? schemas.serverPushes : schemas.clientPushes)?.[name],
          value,
          name,
          "push",
        );
        if (res.success)
          (isClient ? buses.sPush : buses.cPush).dispatchEvent(
            new SocketEvent(name, { ...body, value: res.value }, headers, context),
          );
      } else if (method === "REQUEST") {
        const res = await validate(
          (isClient ? schemas.serverRequests : schemas.clientRequests)?.[name]?.[0],
          value,
          name,
          "req",
        );
        if (res.success)
          (isClient ? buses.sReq : buses.cReq).dispatchEvent(
            new SocketEvent(name, { ...body, value: res.value }, headers, context),
          );
      } else if (method === "RESPONSE") {
        const res = await validate(
          (isClient ? schemas.clientRequests : schemas.serverRequests)?.[name]?.[1],
          value,
          name,
          "res",
        );
        if (res.success)
          (isClient ? buses.sRes : buses.cRes).dispatchEvent(
            new SocketEvent(name, { ...body, value: res.value }, headers, context),
          );
      }
    } catch {}
  };

  const cPushApi = setupPush(
    Object.keys(schemas.clientPushes ?? {}),
    buses.cPush,
    buses.sPush,
    true,
  );
  const sPushApi = setupPush(
    Object.keys(schemas.serverPushes ?? {}),
    buses.sPush,
    buses.cPush,
    false,
  );
  const cReqApi = setupReq(
    Object.keys(schemas.clientRequests ?? {}),
    buses.cReq,
    buses.sRes,
    options?.clientTimeout ?? DEFAULT_TIMEOUT,
    true,
  );
  const sReqApi = setupReq(
    Object.keys(schemas.serverRequests ?? {}),
    buses.sReq,
    buses.cRes,
    options?.serverTimeout ?? DEFAULT_TIMEOUT,
    false,
  );

  type ClientApi = {
    push: { [K in keyof CPush]: (...data: Arg<CPush[K]["push"]>) => void };
    request: {
      [K in keyof CReq]: (...data: Arg<CReq[K]["req"], RequestOption>) => Promise<CReq[K]["res"]>;
    };
    onPush: {
      [K in keyof SPush]: (
        handler: (payload: SPush[K]["push"], headers: SocketHeaders) => void,
      ) => () => void;
    };
    onRequest: {
      [K in keyof SReq]: (
        handler: (
          payload: SReq[K]["req"],
          headers: SocketHeaders,
        ) => SReq[K]["res"] | Promise<SReq[K]["res"]>,
      ) => () => void;
    };
  };
  type ServerApi = {
    push: { [K in keyof SPush]: (...data: Arg<SPush[K]["push"]>) => void };
    request: {
      [K in keyof SReq]: (...data: Arg<SReq[K]["req"], RequestOption>) => Promise<SReq[K]["res"]>[];
    };
    onPush: {
      [K in keyof CPush]: (
        handler: (payload: CPush[K]["push"], headers: SocketHeaders) => void,
      ) => () => void;
    };
    onRequest: {
      [K in keyof CReq]: (
        handler: (
          payload: CReq[K]["req"],
          headers: SocketHeaders,
        ) => CReq[K]["res"] | Promise<CReq[K]["res"]>,
      ) => () => void;
    };
  };

  return {
    client: {
      onMessage: onMessage(true),
      bindWS: (ws: WS) => (clientWS.ws = ws),
      api: {
        push: cPushApi.push,
        request: cReqApi.request,
        onPush: sPushApi.handle,
        onRequest: sReqApi.handle,
      } as ClientApi,
    },
    server: {
      onMessage: onMessage(false),
      addWS: (ws: WS) => serverWS.ws.add(ws),
      removeWS: (ws: WS) => serverWS.ws.delete(ws),
      api: {
        push: sPushApi.push,
        request: sReqApi.request,
        onPush: cPushApi.handle,
        onRequest: cReqApi.handle,
      } as ServerApi,
    },
  };
}

export {
  type StandardSchema,
  SocketError,
  type SocketHeaders,
  type SocketBody,
  type SocketPacket,
  type WS,
  type SocketSchemas,
  defineSocketSchema,
  createSocket,
};

export function createClientSocket<T extends SocketSchemas>(s: T, o?: RequestOption) {
  return createSocket(s, { clientTimeout: o?.timeout }).client;
}
export function createServerSocket<T extends SocketSchemas>(s: T, o?: RequestOption) {
  return createSocket(s, { serverTimeout: o?.timeout }).server;
}
