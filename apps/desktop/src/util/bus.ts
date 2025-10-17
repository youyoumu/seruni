import { EventEmitter } from "node:events";
import type { IPCFromMain, IPCFromMainChannel } from "@repo/preload/ipc";

hmr.log(import.meta);

interface StringKeyedObject {
  // biome-ignore lint: library
  [key: string]: any;
}
// biome-ignore format: library
export interface TypeSafeEventEmitter<C extends StringKeyedObject> extends EventEmitter {
  // K has to be a key on C (the passed type) but it also has to be a string and then we use index
  // types to get the actual type that we expect (C[K]).
  addListener<K extends Extract<keyof C, string>>(eventName: K, listener: (arg: C[K]) => void): this
  on<K extends Extract<keyof C, string>>(eventName: K, listener: (arg: C[K]) => void): this
  once<K extends Extract<keyof C, string>>(eventName: K, listener: (arg: C[K]) => void): this
  removeListener<K extends Extract<keyof C, string>>(eventName: K, listener: (arg: C[K]) => void): this
  off<K extends Extract<keyof C, string>>(eventName: K, listener: (arg: C[K]) => void): this
  removeAllListeners<K extends Extract<keyof C, string>>(eventName?: K): this
  setMaxListeners(n: number): this
  getMaxListeners(): number
  // biome-ignore lint: library
  listeners<K extends Extract<keyof C, string>>(eventName: K): Function[]
  // biome-ignore lint: library
  rawListeners<K extends Extract<keyof C, string>>(eventName: K): Function[]
  emit<K extends Extract<keyof C, string>>(eventName: K, arg: C[K]): boolean
  listenerCount<K extends Extract<keyof C, string>>(eventName: K): number
  prependListener<K extends Extract<keyof C, string>>(eventName: K, listener: (arg: C[K]) => void): this
  prependOnceListener<K extends Extract<keyof C, string>>(eventName: K, listener: (arg: C[K]) => void): this

  //custom
  key: <K extends Extract<keyof C, string>>(eventName: K) => K;
}

export type BusEvents = {
  "webContent:send": {
    channel: string;
    payload: IPCFromMain[IPCFromMainChannel]["input"];
  };
  "mainWindow:reload": undefined;
  "anki:handleNewNote": { noteId: number };
  //
  //
  "test:test": { key: "test:test:result"; data: string };
  "test:test:result": { result: number };
};

export type BusEventName = keyof BusEvents;

class EventEmitter_ extends EventEmitter {
  key<K extends keyof BusEvents>(key: K) {
    return Symbol(key) as unknown as K;
  }
}

export const bus: TypeSafeEventEmitter<BusEvents> = new EventEmitter_();

//example
() => {
  const key = bus.key("test:test:result");
  bus.once(key, ({ result }) => {});
  bus.emit("test:test", { key, data: "" });
  bus.on("test:test", ({ key, data }) => {
    bus.emit(key, { result: 1 });
  });
};

// import { EventEmitter } from "node:events";
// import type { IPCFromMain, IPCFromMainChannel } from "@repo/preload/ipc";
//
// type BusHandler = {
//   "webContent:send": {
//     input: IPCFromMain[IPCFromMainChannel]["input"];
//     output: undefined;
//   };
//   test: {
//     input: [string];
//     output: number;
//   };
// };
// type BusEventName = keyof BusHandler;
// type Handler = (
//   ...args: BusHandler[BusEventName]["input"]
// ) => Promise<BusHandler[BusEventName]["output"]>;
//
// class Bus extends EventEmitter {
//   handlers = new Map<string, Handler>();
//
//   static eventNames = {};
//
//   override on<EventName extends BusEventName>(
//     eventName: EventName,
//     handler: (...payload: BusHandler[EventName]["input"]) => void,
//   ) {
//     return super.on(eventName, handler);
//   }
//
//   handle<EventName extends BusEventName>(
//     eventName: EventName,
//     fn: (
//       ...args: BusHandler[EventName]["input"]
//     ) => Promise<BusHandler[EventName]["output"]>,
//   ) {
//     this.handlers.set(eventName, fn);
//   }
//
//   async request<EventName extends BusEventName>(
//     event: EventName,
//     ...args: BusHandler[EventName]["input"]
//   ) {
//     const fn = this.handlers.get(event) as (
//       ...args: BusHandler[EventName]["input"]
//     ) => Promise<BusHandler[EventName]["output"]>;
//     if (!fn) throw new Error(`No handler for ${event}`);
//     return await fn(...args);
//   }
// }
//
// export const bus = new Bus();
