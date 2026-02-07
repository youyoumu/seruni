import { type Logger } from "pino";
import { ReconnectingWebsocket } from "@repo/shared/ws";
import { db } from "#/db";
import { textHistory } from "#/db/schema";
import { type BusCenter } from "#/util/bus";

export class TextHookerClient extends ReconnectingWebsocket {
  messages: string[] = [];
  constructor({
    url = "ws://localhost:6677",
    logger,
    bus,
  }: {
    url?: string;
    logger: Logger;
    bus: BusCenter;
  }) {
    super({
      url,
      logger: logger.child({ name: "text-hooker-client" }),
    });

    this.addEventListener("message", async (event: CustomEventInit<string>) => {
      if (event.detail) {
        this.log.info(`Message: ${event.detail}`);
        const row = await db.insert(textHistory).values({ text: event.detail }).returning().get();
        bus.push.server.dispatchTypedEvent(
          "text_history",
          new CustomEvent("text_history", {
            detail: row,
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
