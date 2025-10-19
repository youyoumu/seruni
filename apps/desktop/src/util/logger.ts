import { Roarr as log_ } from "roarr";
import { bus } from "./bus";

export const log = log_.child<{
  error: unknown;
}>((message) => {
  const error_ =
    message.context.error && message.context.error instanceof Error
      ? {
          message: message.context.error.message,
        }
      : undefined;

  const message_ = {
    ...message,
    context: {
      ...message.context,
      error: error_,
    },
  };

  for (const [key, value] of Object.entries(message_.context)) {
    if (value === undefined)
      delete message_.context[key as keyof typeof message_.context];
  }

  bus.emit("logIPC:send", message_);
  return message_;
});
