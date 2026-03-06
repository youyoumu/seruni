import { SocketCore, type RequestOption } from "./core";
import {
  type Arg,
  type PushSchemas,
  type ReqSchemas,
  type ServerRequestTargetOption,
  type ServerPushOption,
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

  const core = new SocketCore<Schema, ClientState>(schemas, {
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
    (...args: Arg<Req, ServerRequestTargetOption>): Promise<SocketResponse<Res, Err>>;
    (...args: Arg<Req, RequestOption & { ws: undefined }>): Promise<SocketResponse<Res, Err>>[];
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
    onPush: { [K in keyof CPush]: (handler: SocketPushHandler<CPush[K]["push"]>) => () => void };
    /**
     * Handle requests from clients.
     */
    onRequest: {
      [K in keyof CReq]: (
        handler: SocketReqMiddleware<CReq[K]["req"], CReq[K]["res"], CReq[K]["err"]>,
      ) => () => void;
    };
    /**
     * Register a middleware for client requests that matches a pattern.
     */
    useRequest: (
      matcher: SocketRequestMatcher<keyof CReq & string>,
      handler: SocketReqMiddleware<unknown, unknown>,
    ) => () => void;
    /**
     * Map of connected clients and their state.
     */
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

/**
 * A server-side socket implementation using Krissan protocol.
 */
class ServerSocket<T extends SocketSchemas, ClientState extends object = {}> {
  #socket: ReturnType<typeof createServerRuntime<T, ClientState>>;

  /**
   * Creates a new ServerSocket instance.
   * @param schemas The socket schema definition.
   * @param options Configuration options.
   */
  constructor(schemas: T, options?: SocketConstructOption) {
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

export { ServerSocket };
