import {
  KrissanBase,
  KrissanEvent,
  undefinedSchema,
  nullSchema,
  neverSchema,
  KrissanError,
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
  noop,
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
      if (typeof e.data !== "string" || !e.data.startsWith(this.prefix)) return;
      const p: KrissanPacket = JSON.parse(e.data.slice(this.prefix.length));

      const setCookie = p.headers?.["set-cookie"];
      if (setCookie) {
        const sanitized = this.sanitizeCookie(setCookie);
        if (sanitized) this.#cookie = sanitized;
      }

      const {
        method,
        route,
        // TODO: unwrap body
        body: { value },
      } = p;
      const headers: KrissanHeaders = p.headers ?? {};
      const context: KrissanContext = { ws };
      const body = { value };

      if (method === "PUSH") {
        const schema = this.schemas.serverPushes[route] ?? undefinedSchema;
        const res = await this.validate(schema, value, route, "PUSH");
        if (res.success) {
          const event = new KrissanEvent(route, { value: res.value }, headers, context);
          this.ets.sPush.dispatchEvent(event);
        }
      } else if (method === "REQ") {
        const schema = this.schemas.serverRequests[route]?.[0] ?? undefinedSchema;
        const res = await this.validate(schema, value, route, "REQ");
        const eBody = res.success ? { value: res.value } : body;
        const eErr = res.success ? undefined : res.error;
        const event = new KrissanEvent(route, eBody, headers, context, eErr);
        this.ets.sReq.dispatchEvent(event);
      } else if (method === "RES") {
        const schema = this.schemas.clientRequests[route]?.[1] ?? nullSchema;
        const res = await this.validate(schema, value, route, "RES");
        const eBody = res.success ? { value: res.value } : body;
        const eErr = res.success ? undefined : res.error;
        const event = new KrissanEvent(route, eBody, headers, context, eErr);
        this.ets.sRes.dispatchEvent(event);
      } else if (method === "ERR") {
        const schema = this.schemas.clientRequests[route]?.[2] ?? neverSchema;
        const res = await this.validate(schema, value, route, "ERR");
        const eBody = res.success ? { value: res.value } : body;
        const eErr = res.success ? undefined : res.error;
        const event = new KrissanEvent(route, eBody, headers, context, eErr);
        this.ets.sErr.dispatchEvent(event);
      }
    } catch {}
  }

  createClientPushLane(events: readonly string[]) {
    return this.createPushLane(events, this.ets.cPush, (route, data) => {
      const body = { value: data };
      const payload = { method: "PUSH" as const, route, body, headers: this.createHeaders() };
      this.send(payload);
    });
  }

  createServerPushLane(events: readonly string[]) {
    /* client doesn't push server-initiated pushes */
    return this.createPushLane(events, this.ets.sPush, noop);
  }

  createClientReqLane(events: readonly string[]) {
    return this.createReqLane(
      events,
      this.ets.cReq,
      (route, cid, data, t) => {
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
              resolve({ type: "Success", value: e.body.value });
            }
          });
          const offErr = this.ets.sErr.on(route, async (e) => {
            if (e.headers.cid === cid && e.context.ws === this.ws) {
              clean();
              if (e.issues) return reject(InvalidResponse);
              resolve({ type: "Failure", error: e.body.value });
            }
          });
          // prettier-ignore
          timer = setTimeout(() => { clean(); reject(RequestTimeout); }, t);

          const headers = this.createHeaders(cid);
          const payload = { method: "REQ" as const, route, body: { value: data }, headers };
          this.send(payload);
        });
      },
      this.schemas.clientRequests,
    );
  }

  createServerReqLane(events: readonly string[]) {
    return this.createReqLane(
      events,
      this.ets.sReq,
      /* client doesn't initiate server requests */
      noop,
      this.schemas.serverRequests,
    );
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

  const cPushApi = core.createClientPushLane(Object.keys(schemas.clientPushes));
  const sPushApi = core.createServerPushLane(Object.keys(schemas.serverPushes));
  const cReqApi = core.createClientReqLane(Object.keys(schemas.clientRequests));
  const sReqApi = core.createServerReqLane(Object.keys(schemas.serverRequests));

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
      push: cPushApi.push,
      request: cReqApi.request,
      onPush: sPushApi.handle,
      onRequest: sReqApi.handle,
      useRequest: sReqApi.use,
      usePush: sPushApi.use,
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
