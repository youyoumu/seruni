import { SocketCore, type RequestOption } from "./core";
import {
  type Arg,
  type PushSchemas,
  type ReqSchemas,
  type ServerRequestTargetOption,
  type SocketClientMeta,
  type SocketConstructOption,
  type SocketReqMiddleware,
  type SocketRequestMatcher,
  type SocketResponse,
  type SocketSchemas,
  type SocketPushHandler,
  type WS,
} from "./core";
export * from "./core";

function createServerRuntime<const Schema extends SocketSchemas, ClientState extends object = {}>(
  schemas: Schema,
  options?: SocketConstructOption,
) {
  type CPush = PushSchemas<NonNullable<Schema["clientPushes"]>>;
  type SPush = PushSchemas<NonNullable<Schema["serverPushes"]>>;
  type CReq = ReqSchemas<NonNullable<Schema["clientRequests"]>>;
  type SReq = ReqSchemas<NonNullable<Schema["serverRequests"]>>;
  type ClientRoutes = Extract<keyof CReq, string>;
  type ServerRoutes = Extract<keyof SReq, string>;

  const core = new SocketCore<Schema, ClientState>(schemas, {
    serverTimeout: options?.timeout,
    uid: options?.uid,
    onError: options?.onError,
    protocolId: options?.protocolId,
  });

  const clientRequestRoutes = Object.keys(schemas.clientRequests ?? {}) as ClientRoutes[];
  const serverRequestRoutes = Object.keys(schemas.serverRequests ?? {}) as ServerRoutes[];
  const cPushApi = core.createPushLane(
    Object.keys(schemas.clientPushes ?? {}),
    core.ets.cPush,
    true,
  );
  const sPushApi = core.createPushLane(
    Object.keys(schemas.serverPushes ?? {}),
    core.ets.sPush,
    false,
  );
  const cReqApi = core.createReqLane(
    clientRequestRoutes,
    core.ets.cReq,
    core.ets.sRes,
    core.ets.sErr,
    core.clientTimeout,
    true,
  );
  const sReqApi = core.createReqLane(
    serverRequestRoutes,
    core.ets.sReq,
    core.ets.cRes,
    core.ets.cErr,
    core.serverTimeout,
    false,
  );
  const serverOnMessage = core.createOnMessage(false);

  type ServerRequestFn<Req, Res, Err> = {
    (...args: Arg<Req, ServerRequestTargetOption>): Promise<SocketResponse<Res, Err>>;
    (...args: Arg<Req, RequestOption>): Promise<SocketResponse<Res, Err>>[];
  };

  type ServerApi = {
    push: { [K in keyof SPush]: (...data: Arg<SPush[K]["push"]>) => void };
    request: {
      [K in ServerRoutes]: ServerRequestFn<SReq[K]["req"], SReq[K]["res"], SReq[K]["err"]>;
    };
    onPush: {
      [K in keyof CPush]: (handler: SocketPushHandler<CPush[K]["push"]>) => () => void;
    };
    onRequest: {
      [K in ClientRoutes]: (
        handler: SocketReqMiddleware<CReq[K]["req"], CReq[K]["res"], CReq[K]["err"]>,
      ) => () => void;
    };
    useRequest: (
      matcher: SocketRequestMatcher<ClientRoutes>,
      handler: SocketReqMiddleware<unknown, unknown>,
    ) => () => void;
    clients: Map<WS, { meta: SocketClientMeta } & ClientState>;
  };

  return {
    onMessage: serverOnMessage,
    onOpen: (ws: WS) => {
      core.serverWS.ws.set(ws, {
        meta: { connectedAt: Date.now(), messageCount: 0, lastMessageAt: null },
      } as { meta: SocketClientMeta } & ClientState);
    },
    onClose: (ws: WS) => {
      core.serverWS.ws.delete(ws);
    },
    api: {
      push: sPushApi.push,
      request: sReqApi.request,
      onPush: cPushApi.handle,
      onRequest: cReqApi.handle,
      useRequest: cReqApi.use,
      clients: core.serverWS.ws,
    } as ServerApi,
  };
}

class ServerSocket<T extends SocketSchemas, ClientState extends object = {}> {
  #socket: ReturnType<typeof createServerRuntime<T, ClientState>>;

  constructor(schemas: T, options?: SocketConstructOption) {
    this.#socket = createServerRuntime<T, ClientState>(schemas, options);
  }

  get api() {
    return this.#socket.api;
  }

  onMessage = (e: MessageEvent, ws: WS) => this.#socket.onMessage(e, ws);
  onOpen = (ws: WS) => this.#socket.onOpen(ws);
  onClose = (ws: WS) => this.#socket.onClose(ws);
}

export { ServerSocket };
