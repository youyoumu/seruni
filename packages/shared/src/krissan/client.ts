import { SocketCore } from "./core";
import {
  type Arg,
  type PushSchemas,
  type ReqSchemas,
  type RequestOption,
  type SocketConstructOption,
  type SocketReqMiddleware,
  type SocketRequestMatcher,
  type SocketResponse,
  type SocketSchemas,
  type SocketPushHandler,
  type WS,
} from "./core";
export * from "./core";

function createClientRuntime<const Schema extends SocketSchemas>(
  schemas: Schema,
  options?: SocketConstructOption,
) {
  type CPush = PushSchemas<NonNullable<Schema["clientPushes"]>>;
  type SPush = PushSchemas<NonNullable<Schema["serverPushes"]>>;
  type CReq = ReqSchemas<NonNullable<Schema["clientRequests"]>>;
  type SReq = ReqSchemas<NonNullable<Schema["serverRequests"]>>;

  const core = new SocketCore<Schema>(schemas, {
    clientTimeout: options?.timeout,
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
  const clientOnMessage = core.createOnMessage(true);

  /**
   * API for interacting with the socket.
   */
  type ClientApi = {
    /**
     * Send a push message to the server.
     */
    push: { [K in keyof CPush]: (...data: Arg<CPush[K]["push"]>) => void };
    /**
     * Send a request to the server and wait for a response.
     */
    request: {
      [K in keyof CReq]: (
        ...data: Arg<CReq[K]["req"], RequestOption>
      ) => Promise<SocketResponse<CReq[K]["res"], CReq[K]["err"]>>;
    };
    /**
     * Listen for push messages from the server.
     */
    onPush: { [K in keyof SPush]: (handler: SocketPushHandler<SPush[K]["push"]>) => () => void };
    /**
     * Handle requests from the server.
     */
    onRequest: {
      [K in keyof SReq]: (
        handler: SocketReqMiddleware<SReq[K]["req"], SReq[K]["res"], SReq[K]["err"]>,
      ) => () => void;
    };
    /**
     * Register a middleware for server requests that matches a pattern.
     */
    useRequest: (
      matcher: SocketRequestMatcher<keyof CReq & string>,
      handler: SocketReqMiddleware<unknown, unknown>,
    ) => () => void;
  };

  return {
    onMessage: clientOnMessage,
    onOpen: (ws: WS) => {
      core.clientWS.ws = ws;
    },
    onClose: (ws: WS) => {
      if (core.clientWS.ws === ws) core.clientWS.ws = undefined;
    },
    api: {
      push: cPushApi.push,
      request: cReqApi.request,
      onPush: sPushApi.handle,
      onRequest: sReqApi.handle,
      useRequest: sReqApi.use,
    } as ClientApi,
  };
}

/**
 * A client-side socket implementation using Krissan protocol.
 */
class ClientSocket<T extends SocketSchemas> {
  #socket: ReturnType<typeof createClientRuntime<T>>;

  /**
   * Creates a new ClientSocket instance.
   * @param schemas The socket schema definition.
   * @param options Configuration options.
   */
  constructor(schemas: T, options?: SocketConstructOption) {
    this.#socket = createClientRuntime(schemas, options);
  }

  /**
   * Access to the typed socket API.
   */
  get api() {
    return this.#socket.api;
  }

  /**
   * Should be called when a message is received on the underlying WebSocket.
   */
  onMessage = (e: MessageEvent, ws: WS) => this.#socket.onMessage(e, ws);
  /**
   * Should be called when the underlying WebSocket is opened.
   */
  onOpen = (ws: WS) => this.#socket.onOpen(ws);
  /**
   * Should be called when the underlying WebSocket is closed.
   */
  onClose = (ws: WS) => this.#socket.onClose(ws);
}

export { ClientSocket };
