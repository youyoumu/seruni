import {
  KrissanBase,
  undefinedSchema,
  nullSchema,
  neverSchema,
  KrissanError,
  PUSH,
  REQ,
  RES,
  ERR,
  type Arg,
  type PushSchemas,
  type ReqSchemas,
  type RequestOption,
  type KrissanConstructOption,
  type KrissanPushMatcher,
  type KrissanReqMiddleware,
  type KrissanRequestMatcher,
  type KrissanResponse,
  type KrissanSchemas,
  type KrissanPushHandler,
  type WS,
  type KrissanPacket,
  type KrissanHeaders,
  type KrissanContext,
} from "./core";
export * from "./core";

class KrissanClientCore<const Schema extends KrissanSchemas> extends KrissanBase<Schema> {
  #cookie: Record<string, string> = {};
  ws: WS | undefined;

  constructor(schemas: Schema, options?: KrissanConstructOption) {
    super(schemas, options);
  }

  protected createHeaders(cid?: string): KrissanHeaders {
    const headers: KrissanHeaders = { timestamp: Date.now() };
    if (cid) headers.cid = cid;
    if (Object.keys(this.#cookie).length > 0) headers.cookie = this.#cookie;
    return headers;
  }

  protected send(payload: KrissanPacket) {
    const data = `${this.prefix}${JSON.stringify(payload)}`;
    if (this.ws?.readyState === 1) this.ws.send(data);
  }

  //TODO: client no state
  protected getState(_ws: WS): undefined {
    return undefined;
  }

  async onMessage(e: MessageEvent, ws: WS) {
    try {
      const pre = this.prefix;
      if (typeof e.data !== "string" || !e.data.startsWith(pre)) return;
      const p: KrissanPacket = JSON.parse(e.data.slice(pre.length));

      const setCookie = p.headers?.["set-cookie"];
      if (setCookie) {
        const sanitized = this.sanitizeCookie(setCookie);
        if (sanitized) this.#cookie = sanitized;
      }

      const { method, route, body } = p;
      const headers: KrissanHeaders = p.headers ?? {};
      const context: KrissanContext = { ws };
      const s = this.schemas;
      const ets = this.ets;

      if (method === PUSH) {
        await this.emit(
          ets.sPush,
          s.serverPushes[route] ?? undefinedSchema,
          body,
          route,
          PUSH,
          headers,
          context,
        );
      } else if (method === REQ) {
        await this.emit(
          ets.sReq,
          s.serverRequests[route]?.[0] ?? undefinedSchema,
          body,
          route,
          REQ,
          headers,
          context,
        );
      } else if (method === RES) {
        await this.emit(
          ets.sRes,
          s.clientRequests[route]?.[1] ?? nullSchema,
          body,
          route,
          RES,
          headers,
          context,
        );
      } else if (method === ERR) {
        await this.emit(
          ets.sErr,
          s.clientRequests[route]?.[2] ?? neverSchema,
          body,
          route,
          ERR,
          headers,
          context,
        );
      }
    } catch {}
  }

  getPushApi(events: readonly string[]) {
    return this.createPushApi(events, (route, body) => {
      const payload = { method: PUSH, route, body, headers: this.createHeaders() };
      this.send(payload);
    });
  }

  getPushHandler(events: readonly string[]) {
    return this.createPushHandler(events, this.ets.sPush);
  }

  getReqApi(events: readonly string[]) {
    return this.createReqApi(events, (route, cid, body, t) => {
      const ConnectionClosed = new KrissanError(KrissanError.ConnectionClosed);
      const RequestTimeout = new KrissanError(KrissanError.RequestTimeout);
      const InvalidResponse = new KrissanError(KrissanError.InvalidResponse);
      return new Promise((resolve, reject) => {
        if (!this.ws || this.ws.readyState !== 1) return reject(ConnectionClosed);

        let timer: ReturnType<typeof setTimeout>;
        // prettier-ignore
        const clean = () => { clearTimeout(timer); off(); offErr(); };
        const off = this.ets.sRes.on(route, (e) => {
          if (e.headers.cid === cid && e.context.ws === this.ws) {
            clean();
            if (e.issues) return reject(InvalidResponse);
            resolve({ type: "Success", value: e.body });
          }
        });
        const offErr = this.ets.sErr.on(route, async (e) => {
          if (e.headers.cid === cid && e.context.ws === this.ws) {
            clean();
            if (e.issues) return reject(InvalidResponse);
            resolve({ type: "Failure", error: e.body });
          }
        });
        // prettier-ignore
        timer = setTimeout(() => { clean(); reject(RequestTimeout); }, t);

        const headers = this.createHeaders(cid);
        const payload = { method: REQ, route, body, headers };
        this.send(payload);
      });
    });
  }

  getReqHandler(events: readonly string[]) {
    return this.createRequestHandler(events, this.ets.sReq, this.schemas.serverRequests);
  }
}

function createClientRuntime<const Schema extends KrissanSchemas>(
  schemas: Schema,
  options?: KrissanConstructOption,
) {
  type CPush = PushSchemas<NonNullable<Schema["clientPushes"]>>;
  type SPush = PushSchemas<NonNullable<Schema["serverPushes"]>>;
  type CReq = ReqSchemas<NonNullable<Schema["clientRequests"]>>;
  type SReq = ReqSchemas<NonNullable<Schema["serverRequests"]>>;

  const core = new KrissanClientCore<Schema>(schemas, options);

  const pushApi = core.getPushApi(Object.keys(schemas.clientPushes));
  const pushHandler = core.getPushHandler(Object.keys(schemas.serverPushes));
  const reqApi = core.getReqApi(Object.keys(schemas.clientRequests));
  const reqHandler = core.getReqHandler(Object.keys(schemas.serverRequests));

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
      ) => Promise<KrissanResponse<CReq[K]["res"], CReq[K]["err"]>>;
    };
    /**
     * Listen for push messages from the server.
     */
    onPush: { [K in keyof SPush]: (handler: KrissanPushHandler<SPush[K]["push"]>) => () => void };
    /**
     * Handle requests from the server.
     */
    onRequest: {
      [K in keyof SReq]: (
        handler: KrissanReqMiddleware<SReq[K]["req"], SReq[K]["res"], SReq[K]["err"]>,
      ) => () => void;
    };
    /**
     * Register a middleware for server requests that matches a pattern.
     */
    useRequest: (
      matcher: KrissanRequestMatcher<keyof CReq & string>,
      handler: KrissanReqMiddleware,
    ) => () => void;
    /**
     * Register a handler for push messages that matches a pattern.
     */
    usePush: (
      matcher: KrissanPushMatcher<keyof SPush & string>,
      handler: KrissanPushHandler,
    ) => () => void;
  };

  return {
    onMessage: (e: MessageEvent, ws: WS) => core.onMessage(e, ws),
    onOpen: (ws: WS) => {
      core.ws = ws;
    },
    onClose: (ws: WS) => {
      if (core.ws === ws) core.ws = undefined;
    },
    api: {
      push: pushApi.push,
      request: reqApi.request,
      onPush: pushHandler.handle,
      onRequest: reqHandler.handle,
      useRequest: reqHandler.use,
      usePush: pushHandler.use,
    } as ClientApi,
  };
}

/**
 * A client-side socket implementation using Krissan protocol.
 */
class KrissanClient<T extends KrissanSchemas> {
  #socket: ReturnType<typeof createClientRuntime<T>>;

  /**
   * Creates a new KrissanClient instance.
   * @param schemas The socket schema definition.
   * @param options Configuration options.
   */
  constructor(schemas: T, options?: KrissanConstructOption) {
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

export { KrissanClient };
