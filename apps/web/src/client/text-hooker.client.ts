import { Logger } from "pino";
import { ReconnectingWebsocket } from "./ReconnectingWebsocket";

export class TextHookerClient extends ReconnectingWebsocket {
  messages: string[] = [];

  constructor({ url = "ws://localhost:6677", logger }: { url?: string; logger: Logger }) {
    super({
      name: "text-hooker-client",
      url,
      logger,
    });
    this.addEventListener("message", (event: CustomEventInit<string>) => {
      this.log.info(`Message: ${event.detail}`);
      if (event.detail) this.messages.push(event.detail);
    });
  }

  getMessages(): string[] {
    return [...this.messages];
  }

  clearMessages() {
    this.messages = [];
  }
}
