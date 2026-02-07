import {
  ClientPushBus,
  ServerPushBus,
  ClientReqBus,
  ServerResBus,
  ServerReqBus,
  ClientResBus,
} from "@repo/shared/events";
import type { ClientReqEventMap, ServerResEventMap } from "@repo/shared/types";
import { CLIENT_REQ_MAP } from "@repo/shared/types";

export type BusCenter = ReturnType<typeof createBusCenter>;

export function createBusCenter() {
  const clientPushBus = new ClientPushBus();
  const serverPushBus = new ServerPushBus();

  const serverResBus = new ServerResBus();
  const clientReqBus = new ClientReqBus(serverResBus);

  const clientResBus = new ClientResBus();
  const serverReqBus = new ServerReqBus(clientResBus);

  const bus = {
    client: {
      push: clientPushBus,
      req: clientReqBus,
      res: clientResBus,
    },
    server: {
      push: serverPushBus,
      req: serverReqBus,
      res: serverResBus,
    },
    api: {
      push: serverPushBus.dispatchTypedEvent,
      onpush: serverPushBus.addEventListener,
    },
  };

  const addReqHandler = <
    K extends keyof ClientReqEventMap,
    V extends (typeof CLIENT_REQ_MAP)[K],
    R extends ServerResEventMap[V]["detail"]["data"],
  >(
    type: K,
    value: (payload: ClientReqEventMap[K]["detail"]["data"]) => R,
  ) => {
    const v = CLIENT_REQ_MAP[type];
    bus.client.req.addEventListener(type, (e) => {
      bus.server.res.dispatchTypedEvent(
        v,
        new CustomEvent(v, {
          detail: {
            data: value(e.detail.data),
            requestId: e.detail.requestId,
          },
        }),
      );
    });
  };

  return {
    client: {
      push: clientPushBus,
      req: clientReqBus,
      res: clientResBus,
    },
    server: {
      push: serverPushBus,
      req: serverReqBus,
      res: serverResBus,
    },
    api: {
      push: serverPushBus.dispatchTypedEvent,
      addPushHandler: clientPushBus.addEventListener.bind(clientPushBus),
      addReqHandler,
      request: serverReqBus.request,
    },
  };
}
