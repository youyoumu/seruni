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
  type KrissanClientMeta,
  type ServerPushTargetPicker,
  type ServerRequestTargetPicker,
  type ServerRequestTargetPickerSingle,
  type ServerRequestTargetPickerMulti,
  noop,
} from "./core";
export * from "./core";

class KrissanServerCore<
  const Schema extends KrissanSchemas,
  ClientState extends object = {},
> extends KrissanBase<Schema, { meta: KrissanClientMeta } & ClientState> {
  readonly ws = new Map<WS, { meta: KrissanClientMeta } & ClientState>();

  constructor(schemas: Schema, options?: KrissanConstructOption) {
    super(schemas, options);
  }

  protected createHeaders(cid?: string): KrissanHeaders {
    const headers: KrissanHeaders = { timestamp: Date.now() };
    if (cid) headers.cid = cid;
    return headers;
  }

  protected send(payload: KrissanPacket, ws: WS) {
    const data = `${this.prefix}${JSON.stringify(payload)}`;
    if (ws.readyState === 1) ws.send(data);
  }

  protected getState(ws: WS): ({ meta: KrissanClientMeta } & ClientState) | undefined {
    return this.ws.get(ws);
  }

  async onMessage(e: MessageEvent, ws: WS) {
    try {
      if (typeof e.data !== "string" || !e.data.startsWith(this.prefix)) return;
      const p: KrissanPacket = JSON.parse(e.data.slice(this.prefix.length));

      const clientData = this.ws.get(ws);
      if (!clientData) return;

      const meta = clientData.meta;
      meta.messageCount++;
      meta.lastMessageAt = Date.now();

      const { method, route, body } = p;
      const headers: KrissanHeaders = p.headers ?? {};
      const context: KrissanContext = { ws };

      if (method === "PUSH") {
        const schema = this.schemas.clientPushes[route] ?? undefinedSchema;
        const res = await this.validate(schema, body, route, "PUSH");
        if (res.success) {
          const event = new KrissanEvent(route, res.value, headers, context);
          this.ets.cPush.dispatchEvent(event);
        }
      } else if (method === "REQ") {
        const schema = this.schemas.clientRequests[route]?.[0] ?? undefinedSchema;
        const res = await this.validate(schema, body, route, "REQ");
        const eBody = res.success ? res.value : body;
        const eErr = res.success ? undefined : res.error;
        const event = new KrissanEvent(route, eBody, headers, context, eErr);
        this.ets.cReq.dispatchEvent(event);
      } else if (method === "RES") {
        const schema = this.schemas.serverRequests[route]?.[1] ?? nullSchema;
        const res = await this.validate(schema, body, route, "RES");
        const eBody = res.success ? res.value : body;
        const eErr = res.success ? undefined : res.error;
        const event = new KrissanEvent(route, eBody, headers, context, eErr);
        this.ets.cRes.dispatchEvent(event);
      } else if (method === "ERR") {
        const schema = this.schemas.serverRequests[route]?.[2] ?? neverSchema;
        const res = await this.validate(schema, body, route, "ERR");
        const eBody = res.success ? res.value : body;
        const eErr = res.success ? undefined : res.error;
        const event = new KrissanEvent(route, eBody, headers, context, eErr);
        this.ets.cErr.dispatchEvent(event);
      }
    } catch {}
  }

  createClientPushLane(events: readonly string[]) {
    /* server doesn't push client-initiated pushes */
    return this.createPushLane(events, this.ets.cPush, noop);
  }

  createServerPushLane(events: readonly string[]) {
    return this.createPushLane<ServerPushTargetPicker>(
      events,
      this.ets.sPush,
      (route, data, target) => {
        const exec = (ws: WS) => {
          const headers = this.createHeaders();
          const payload = { method: "PUSH" as const, route, body: data, headers };
          this.send(payload, ws);
        };

        const clients = Array.from(this.ws.keys());
        if (target) {
          if (typeof target === "function") {
            const picked = target(clients);
            if (Array.isArray(picked)) return picked.forEach(exec);
            if (picked) return exec(picked);
            return;
          }
          if (Array.isArray(target)) return target.forEach(exec);
          return exec(target);
        }
        clients.forEach(exec);
      },
    );
  }

  createClientReqLane(events: readonly string[]) {
    return this.createReqLane(
      events,
      this.ets.cReq,
      /* server doesn't initiate client requests */
      noop,
      this.schemas.clientRequests,
    );
  }

  createServerReqLane(events: readonly string[]) {
    return this.createReqLane<ServerRequestTargetPicker>(
      events,
      this.ets.sReq,
      (route, cid, data, t, target) => {
        const exec = (ws?: WS): Promise<KrissanResponse> => {
          return new Promise((resolve, reject) => {
            if (!ws) return reject(new KrissanError(KrissanError.ConnectionClosed));
            let timer: ReturnType<typeof setTimeout>;
            // prettier-ignore
            const clean = () => { clearTimeout(timer); off(); offErr(); };
            const off = this.ets.cRes.on(route, (e) => {
              if (e.headers.cid === cid && e.context.ws === ws) {
                clean();
                if (e.issues) return reject(new KrissanError(KrissanError.InvalidResponse));
                resolve({ type: "Success", value: e.body });
              }
            });
            const offErr = this.ets.cErr.on(route, async (e) => {
              if (e.headers.cid === cid && e.context.ws === ws) {
                clean();
                if (e.issues) return reject(new KrissanError(KrissanError.InvalidResponse));
                resolve({ type: "Failure", error: e.body });
              }
            });
            timer = setTimeout(() => {
              clean();
              reject(new KrissanError(KrissanError.RequestTimeout));
            }, t);

            const headers = this.createHeaders(cid);
            const payload = { method: "REQ" as const, route, body: data, headers };
            this.send(payload, ws);
          });
        };

        const clients = Array.from(this.ws.keys());
        if (target) {
          if (Array.isArray(target)) return target.map(exec);
          if (typeof target === "function") {
            const picked = target(clients);
            if (Array.isArray(picked)) return picked.map(exec);
            return exec(picked);
          }
          return exec(target);
        }
        return clients.map(exec);
      },
      this.schemas.serverRequests,
    );
  }
}

function createServerRuntime<const Schema extends KrissanSchemas, ClientState extends object = {}>(
  schemas: Schema,
  options?: KrissanConstructOption,
) {
  type CPush = PushSchemas<NonNullable<Schema["clientPushes"]>>;
  type SPush = PushSchemas<NonNullable<Schema["serverPushes"]>>;
  type CReq = ReqSchemas<NonNullable<Schema["clientRequests"]>>;
  type SReq = ReqSchemas<NonNullable<Schema["serverRequests"]>>;

  const core = new KrissanServerCore<Schema, ClientState>(schemas, options);

  const cPushApi = core.createClientPushLane(Object.keys(schemas.clientPushes));
  const sPushApi = core.createServerPushLane(Object.keys(schemas.serverPushes));
  const cReqApi = core.createClientReqLane(Object.keys(schemas.clientRequests));
  const sReqApi = core.createServerReqLane(Object.keys(schemas.serverRequests));

  // prettier-ignore
  type ServerRequestFn<Req, Res, Err> = {
    ( ...args: Arg<Req, RequestOption, ServerRequestTargetPickerSingle>): Promise<KrissanResponse<Res, Err>>;
    ( ...args: Arg<Req, RequestOption, ServerRequestTargetPickerMulti>): Promise<KrissanResponse<Res, Err>>[];
    (...args: Arg<Req, RequestOption>): Promise<KrissanResponse<Res, Err>>[];
  };

  /**
   * API for interacting with the server socket.
   */
  type ServerApi = {
    /**
     * Push a message to all connected clients or a specific set of clients.
     */
    push: { [K in keyof SPush]: (...args: Arg<SPush[K]["push"], ServerPushTargetPicker>) => void };
    /**
     * Send a request to clients and wait for responses.
     */
    request: { [K in keyof SReq]: ServerRequestFn<SReq[K]["req"], SReq[K]["res"], SReq[K]["err"]> };
    /**
     * Listen for push messages from clients.
     */
    onPush: {
      [K in keyof CPush]: (
        handler: KrissanPushHandler<CPush[K]["push"], { meta: KrissanClientMeta } & ClientState>,
      ) => () => void;
    };
    /**
     * Handle requests from clients.
     */
    onRequest: {
      [K in keyof CReq]: (
        handler: KrissanReqMiddleware<
          CReq[K]["req"],
          CReq[K]["res"],
          CReq[K]["err"],
          { meta: KrissanClientMeta } & ClientState
        >,
      ) => () => void;
    };
    /**
     * Register a middleware for client requests that matches a pattern.
     */
    useRequest: (
      matcher: KrissanRequestMatcher<
        keyof CReq & string,
        { meta: KrissanClientMeta } & ClientState
      >,
      handler: KrissanReqMiddleware<
        unknown,
        unknown,
        unknown,
        { meta: KrissanClientMeta } & ClientState
      >,
    ) => () => void;
    /**
     * Register a handler for push messages that matches a pattern.
     */
    usePush: (
      matcher: KrissanPushMatcher<keyof CPush & string, { meta: KrissanClientMeta } & ClientState>,
      handler: KrissanPushHandler<unknown, { meta: KrissanClientMeta } & ClientState>,
    ) => () => void;
    /**
     * Map of connected clients and their state.
     */
    clients: Map<WS, { meta: KrissanClientMeta } & ClientState>;
  };

  return {
    onMessage: (e: MessageEvent, ws: WS) => core.onMessage(e, ws),
    onOpen: (ws: WS) => {
      core.ws.set(ws, {
        meta: { connectedAt: Date.now(), messageCount: 0, lastMessageAt: null },
      } as { meta: KrissanClientMeta } & ClientState);
    },
    onClose: (ws: WS) => {
      core.ws.delete(ws);
    },
    api: {
      push: sPushApi.push,
      request: sReqApi.request,
      onPush: cPushApi.handle,
      onRequest: cReqApi.handle,
      useRequest: cReqApi.use,
      usePush: cPushApi.use,
      clients: core.ws as Map<WS, { meta: KrissanClientMeta } & ClientState>,
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
