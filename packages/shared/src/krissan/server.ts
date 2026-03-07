import { KrissanCore, type RequestOption } from "./core";
import {
  type Arg,
  type PushSchemas,
  type ReqSchemas,
  type ServerRequestTargetOption,
  type ServerPushOption,
  type KrissanClientMeta,
  type KrissanConstructOption,
  type KrissanPushMatcher,
  type KrissanReqMiddleware,
  type KrissanRequestMatcher,
  type KrissanResponse,
  type KrissanSchemas,
  type KrissanPushHandler,
  type WS,
} from "./core";
export * from "./core";

function createServerRuntime<const Schema extends KrissanSchemas, ClientState extends object = {}>(
  schemas: Schema,
  options?: KrissanConstructOption,
) {
  type CPush = PushSchemas<NonNullable<Schema["clientPushes"]>>;
  type SPush = PushSchemas<NonNullable<Schema["serverPushes"]>>;
  type CReq = ReqSchemas<NonNullable<Schema["clientRequests"]>>;
  type SReq = ReqSchemas<NonNullable<Schema["serverRequests"]>>;

  const core = new KrissanCore<Schema, ClientState>(schemas, {
    serverTimeout: options?.timeout,
    uid: options?.uid,
    onError: options?.onError,
    protocolId: options?.protocolId,
  });

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
    Object.keys(schemas.clientRequests ?? {}),
    core.ets.cReq,
    core.ets.sRes,
    core.ets.sErr,
    core.clientTimeout,
    true,
  );
  const sReqApi = core.createReqLane(
    Object.keys(schemas.serverRequests ?? {}),
    core.ets.sReq,
    core.ets.cRes,
    core.ets.cErr,
    core.serverTimeout,
    false,
  );
  const serverOnMessage = core.createOnMessage(false);

  type ServerRequestFn<Req, Res, Err> = {
    (...args: Arg<Req, ServerRequestTargetOption>): Promise<KrissanResponse<Res, Err>>;
    (...args: Arg<Req, RequestOption & { ws: undefined }>): Promise<KrissanResponse<Res, Err>>[];
  };

  /**
   * API for interacting with the server socket.
   */
  type ServerApi = {
    /**
     * Push a message to all connected clients or a specific set of clients.
     */
    push: { [K in keyof SPush]: (...args: Arg<SPush[K]["push"], ServerPushOption>) => void };
    /**
     * Send a request to clients and wait for responses.
     */
    request: { [K in keyof SReq]: ServerRequestFn<SReq[K]["req"], SReq[K]["res"], SReq[K]["err"]> };
    /**
     * Handle push messages from clients.
     */
    onPush: { [K in keyof CPush]: (handler: KrissanPushHandler<CPush[K]["push"]>) => () => void };
    /**
     * Handle requests from clients.
     */
    onRequest: {
      [K in keyof CReq]: (
        handler: KrissanReqMiddleware<CReq[K]["req"], CReq[K]["res"], CReq[K]["err"]>,
      ) => () => void;
    };
    /**
     * Register a middleware for client requests that matches a pattern.
     */
    useRequest: (
      matcher: KrissanRequestMatcher<keyof CReq & string>,
      handler: KrissanReqMiddleware,
    ) => () => void;
    /**
     * Register a handler for push messages that matches a pattern.
     */
    usePush: (
      matcher: KrissanPushMatcher<keyof CPush & string>,
      handler: KrissanPushHandler,
    ) => () => void;
    /**
     * Map of connected clients and their state.
     */
    clients: Map<WS, { meta: KrissanClientMeta } & ClientState>;
  };

  return {
    onMessage: serverOnMessage,
    onOpen: (ws: WS) => {
      core.serverWS.ws.set(ws, {
        meta: { connectedAt: Date.now(), messageCount: 0, lastMessageAt: null },
      } as { meta: KrissanClientMeta } & ClientState);
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
      usePush: cPushApi.use,
      clients: core.serverWS.ws,
    } as ServerApi,
  };
}

/**
 * A server-side socket implementation using Krissan protocol.
 */
class KrissanServer<T extends KrissanSchemas, ClientState extends object = {}> {
  #socket: ReturnType<typeof createServerRuntime<T, ClientState>>;

  /**
   * Creates a new KrissanServer instance.
   * @param schemas The socket schema definition.
   * @param options Configuration options.
   */
  constructor(schemas: T, options?: KrissanConstructOption) {
    this.#socket = createServerRuntime<T, ClientState>(schemas, options);
  }

  /**
   * Access to the typed socket API.
   */
  get api() {
    return this.#socket.api;
  }

  /**
   * Should be called when a message is received on a WebSocket.
   */
  onMessage = (e: MessageEvent, ws: WS) => this.#socket.onMessage(e, ws);
  /**
   * Should be called when a WebSocket is opened.
   */
  onOpen = (ws: WS) => this.#socket.onOpen(ws);
  /**
   * Should be called when a WebSocket is closed.
   */
  onClose = (ws: WS) => this.#socket.onClose(ws);
}

export { KrissanServer };
