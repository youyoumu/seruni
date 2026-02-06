import { type AppEventMap } from "#/types/events.types";
import { TypedEventTarget } from "typescript-event-target";

export const eventTarget = new TypedEventTarget<AppEventMap>();
