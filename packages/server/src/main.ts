import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { TextHookerClient } from "./client/text-hooker.client";
import { logger } from "./util/logger";
import { eventTarget } from "./util/eventTarget";

import { createNodeWebSocket } from '@hono/node-ws'

function main() {
  const app = new Hono()
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

  app.get('/', (c) => {
    return c.text('Hello Hono!')
  })

  app.get(
    '/ws',
    upgradeWebSocket(() => {
      return {
        onMessage(event, ws) {
          console.log(`Message from client: ${event.data}`)
        },
        onOpen: (_, ws) => {
          console.log('Connection opened')
          eventTarget.addEventListener("text_history", (e) => {
            ws.send(JSON.stringify(e.detail))
          })
        },
        onClose: () => {
          console.log('Connection closed')
        },
      }
    })
  )

  const server = serve({
    fetch: app.fetch,
    port: 45626
  }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  })

  injectWebSocket(server)

  const textHookerClient = new TextHookerClient({
    logger,
    et: eventTarget,
  });
}

main()
