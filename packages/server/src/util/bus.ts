import {
  ClientPushBus,
  ServerPushBus,
  ClientReqBus,
  ServerResBus,
  ServerReqBus,
  ClientResBus,
} from "@repo/shared/events";

export type BusCenter = ReturnType<typeof createBusCenter>;

export function createBusCenter() {
  const clientPushBus = new ClientPushBus();
  const serverPushBus = new ServerPushBus();

  const serverResBus = new ServerResBus();
  const clientReqBus = new ClientReqBus(serverResBus);

  const clientResBus = new ClientResBus();
  const serverReqBus = new ServerReqBus(clientResBus);

  return {
    push: {
      client: clientPushBus,
      server: serverPushBus,
    },
    req: {
      client: clientReqBus,
      server: serverReqBus,
    },
    res: {
      client: clientResBus,
      server: serverResBus,
    },
  };
}
