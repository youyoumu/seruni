import { type Logger } from "pino";
import { ReconnectingWebsocket } from "@repo/shared/ws";
import { db } from "#/db";
import { textHistory } from "#/db/schema";
import { type ServerResBus } from "#/util/bus";
import { uid } from "uid";

export class TextHookerClient extends ReconnectingWebsocket {
  messages: string[] = [];
  constructor({
    url = "ws://localhost:6677",
    logger,
    serverResBus,
  }: {
    url?: string;
    logger: Logger;
    serverResBus: ServerResBus;
  }) {
    super({
      url,
      logger: logger.child({ name: "text-hooker-client" }),
    });

    this.addEventListener("message", async (event: CustomEventInit<string>) => {
      if (event.detail) {
        this.log.info(`Message: ${event.detail}`);
        const row = await db.insert(textHistory).values({ text: event.detail }).returning().get();
        serverResBus.dispatchTypedEvent(
          "text_history",
          new CustomEvent("text_history", {
            detail: {
              data: row,
              requestId: uid(),
            },
          }),
        );
      }
    });
  }

  getMessages(): string[] {
    return [...this.messages];
  }

  clearMessages() {
    this.messages = [];
  }
}
