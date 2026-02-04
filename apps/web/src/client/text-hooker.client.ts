import { ReconnectingWebsocket } from "./ReconnectingWebsocket";

export class TextHookerClient extends ReconnectingWebsocket {
  private messages: string[] = [];

  constructor(url: string = "ws://localhost:6677") {
    super(url);
    this.addEventListener("message", (event: CustomEventInit<string>) => {
      console.log(event.detail);
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
