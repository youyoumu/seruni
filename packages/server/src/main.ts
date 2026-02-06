import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { TextHookerClient } from "./client/text-hooker.client";
import { logger } from "./util/logger";
import { eventTarget } from "./util/eventTarget";

function main() {
  const app = new Hono()

  app.get('/', (c) => {
    return c.text('Hello Hono!')
  })

  serve({
    fetch: app.fetch,
    port: 3000
  }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  })


  const textHookerClient = new TextHookerClient({
    logger,
    et: eventTarget,
  });
}

main()
