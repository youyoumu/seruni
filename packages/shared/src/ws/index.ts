export * from "./ReconnectingWebsocket";

export interface WSPayload {
  type: "push" | "req" | "res";
  tag: string;
  data: unknown;
}
