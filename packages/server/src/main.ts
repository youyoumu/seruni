import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { TextHookerClient } from "./client/text-hooker.client";
import { createLogger } from "./util/logger";

import { createNodeWebSocket } from '@hono/node-ws'
import { createBus } from './util/bus';

function main() {
  const logger = createLogger();
  const bus = createBus();

  const app = new Hono()
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

  app.get('/', (c) => {
    return c.text('Hello Hono!')
  })

  const log = logger.child({ name: "client" })

  app.get(
    '/ws',
    upgradeWebSocket(() => {
      return {
        onMessage(event, ws) { },
        onOpen: (_, ws) => {
          log.info('Connection opened')
          bus.addEventListener("text_history", (e) => {
            ws.send(JSON.stringify({
              type: "text_history",
              data: e.detail,
            }))
          })
        },
        onClose: () => {
          log.warn('Connection closed')
        },
      }
    })
  )

  const server = serve({
    fetch: app.fetch,
    port: 45626
  }, (info) => {
    logger.info(`Server is running on http://localhost:${info.port}`)
  })

  injectWebSocket(server)

  const textHookerClient = new TextHookerClient({
    logger,
    bus,
  });
}

main()
