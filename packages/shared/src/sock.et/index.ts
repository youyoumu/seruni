import { R } from "@praha/byethrow";
import { type StandardSchemaV1 } from "@standard-schema/spec";
import { uid } from "uid";

type StandardSchema = StandardSchemaV1;
type Infer<T extends StandardSchema> = StandardSchemaV1.InferOutput<T>;
type Arg<T1, T2 = undefined> = undefined extends T1
  ? undefined extends T2
    ? [arg1?: T1, arg2?: T2]
    : [arg1: T1 | undefined, arg2: T2]
  : undefined extends T2
    ? [arg1: T1, arg2?: T2]
    : [arg1: T1, arg2: T2];

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

interface SocketEnvelope<T = unknown> {
  data: T;
  cid: string;
  ws?: WS;
}
interface SocketPacket {
  "sock.et": typeof SOCKET_MAGIC_NUMBER;
  type: "push" | "req" | "res";
  name: string;
  envelope: SocketEnvelope;
}
interface WS {
  send: (data: string) => void;
  readyState: WebSocket["readyState"];
}

const SOCKET_MAGIC_NUMBER = 16777619;
const DEFAULT_TIMEOUT = 300000;

class SocketEvent extends Event {
  constructor(
    type: string,
    public envelope: SocketEnvelope,
  ) {
    super(type);
  }
}

class Bus extends EventTarget {
  on(name: string, handler: (envelope: SocketEnvelope) => void) {
    const fn = (e: Event) => e instanceof SocketEvent && handler(e.envelope);
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
  const serverWS = { ws: new Set<WS>() };
  const buses = {
    cPush: new Bus(),
    sPush: new Bus(),
    cReq: new Bus(),
    sReq: new Bus(),
    cRes: new Bus(),
    sRes: new Bus(),
  };

  const send = (payload: SocketPacket, ws?: WS) => {
    const data = JSON.stringify(payload);
    if (ws) ws.send(data);
    else if (clientWS.ws?.readyState === 1) clientWS.ws.send(data);
    else serverWS.ws.forEach((s) => s.readyState === 1 && s.send(data));
  };

  const setupPush = (names: string[], bus: Bus, reverseBus: Bus, _isClient: boolean) => {
    const api: {
      push: Record<string, (...data: unknown[]) => void>;
      handle: Record<string, (handler: (data: unknown) => void) => () => void>;
    } = {
      push: {},
      handle: {},
    };
    names.forEach((name) => {
      api.push[name] = (data: unknown) => {
        const envelope = { data, cid: uid() };
        bus.dispatchEvent(new SocketEvent(name, envelope));
        send({ "sock.et": SOCKET_MAGIC_NUMBER, type: "push", name, envelope });
      };
      api.handle[name] = (handler: (data: unknown) => void) =>
        reverseBus.on(name, (e) => handler(e.data));
    });
    return api;
  };

  type RequestOption = { timeout?: number } | undefined;

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
      handle: Record<string, (handler: (data: unknown) => unknown) => () => void>;
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
              if (e.cid === cid && (!ws || e.ws === ws)) {
                clean();
                resolve(e.data);
              }
            });
            const offErr = resBus.on("__error__", (e) => {
              if (e.cid === cid && (!ws || e.ws === ws)) {
                clean();
                reject(e.data);
              }
            });
            timer = setTimeout(() => {
              clean();
              reject(new SocketError(SocketError.RequestTimeout));
            }, t);
            const envelope = { data, cid, ws };
            reqBus.dispatchEvent(new SocketEvent(name, envelope));
            if (!isClient || clientWS.ws?.readyState === 1) {
              send({ "sock.et": SOCKET_MAGIC_NUMBER, type: "req", name, envelope }, ws);
            } else {
              resBus.dispatchEvent(
                new SocketEvent("__error__", {
                  data: new SocketError(SocketError.ConnectionClosed),
                  cid,
                }),
              );
            }
          });
        return isClient ? exec() : Array.from(serverWS.ws).map(exec);
      };
      api.handle[name] = (handler: (data: unknown) => unknown) =>
        reqBus.on(name, async (e) => {
          const result = await handler(e.data);
          const envelope = { data: result, cid: e.cid, ws: e.ws };
          resBus.dispatchEvent(new SocketEvent(name, envelope));
          send({ "sock.et": SOCKET_MAGIC_NUMBER, type: "res", name, envelope }, e.ws);
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
      return R.fail();
    }
    return R.succeed(res.value);
  };

  const onMessage = (isClient: boolean) => async (e: MessageEvent, ws_?: WS) => {
    try {
      const p = JSON.parse(e.data);
      if (p["sock.et"] !== SOCKET_MAGIC_NUMBER) return;
      const {
        type,
        name,
        envelope: { data, cid },
      } = p;
      const ws = isClient ? undefined : ws_;
      const envelope = { data, cid, ws };

      if (type === "push") {
        const res = await validate(
          (isClient ? schemas.serverPushes : schemas.clientPushes)?.[name],
          data,
          name,
          "push",
        );
        if (R.isSuccess(res))
          (isClient ? buses.sPush : buses.cPush).dispatchEvent(
            new SocketEvent(name, { ...envelope, data: res.value }),
          );
      } else if (type === "req") {
        const res = await validate(
          (isClient ? schemas.serverRequests : schemas.clientRequests)?.[name]?.[0],
          data,
          name,
          "req",
        );
        if (R.isSuccess(res))
          (isClient ? buses.sReq : buses.cReq).dispatchEvent(
            new SocketEvent(name, { ...envelope, data: res.value }),
          );
      } else if (type === "res") {
        const res = await validate(
          (isClient ? schemas.clientRequests : schemas.serverRequests)?.[name]?.[1],
          data,
          name,
          "res",
        );
        if (R.isSuccess(res))
          (isClient ? buses.sRes : buses.cRes).dispatchEvent(
            new SocketEvent(name, { ...envelope, data: res.value }),
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
      [K in keyof CReq]: (
        ...data: Arg<CReq[K]["req"], { timeout?: number } | undefined>
      ) => Promise<CReq[K]["res"]>;
    };
    onPush: { [K in keyof SPush]: (handler: (payload: SPush[K]["push"]) => void) => () => void };
    onRequest: {
      [K in keyof SReq]: (
        handler: (payload: SReq[K]["req"]) => SReq[K]["res"] | Promise<SReq[K]["res"]>,
      ) => () => void;
    };
  };
  type ServerApi = {
    push: { [K in keyof SPush]: (...data: Arg<SPush[K]["push"]>) => void };
    request: {
      [K in keyof SReq]: (
        ...data: Arg<SReq[K]["req"], { timeout?: number } | undefined>
      ) => Promise<SReq[K]["res"]>[];
    };
    onPush: { [K in keyof CPush]: (handler: (payload: CPush[K]["push"]) => void) => () => void };
    onRequest: {
      [K in keyof CReq]: (
        handler: (payload: CReq[K]["req"]) => CReq[K]["res"] | Promise<CReq[K]["res"]>,
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
  type SocketEnvelope,
  type SocketPacket,
  type WS,
  type SocketSchemas,
  defineSocketSchema,
  createSocket,
};

export function createClientSocket<T extends SocketSchemas>(s: T, o?: { timeout?: number }) {
  return createSocket(s, { clientTimeout: o?.timeout }).client;
}
export function createServerSocket<T extends SocketSchemas>(s: T, o?: { timeout?: number }) {
  return createSocket(s, { serverTimeout: o?.timeout }).server;
}
