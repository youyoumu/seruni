export class TypesafeEventTarget<EMap extends Record<string, unknown>> extends EventTarget {
  constructor() {
    super();
  }

  addListener<EName extends keyof EMap & string>(
    type: EName,
    listener: (detail: EMap[EName], event: CustomEventInit<EMap[EName]>) => void,
    options?: boolean | AddEventListenerOptions,
  ) {
    const listener_ = (event: CustomEventInit) => {
      listener(event.detail, event);
    };
    super.addEventListener(type, listener_, options);

    type ListenerRemover = {
      (): void;
      listener: typeof listener_;
    };

    const removeListener = (() => {
      super.removeEventListener(type, listener_, options);
    }) as ListenerRemover;
    removeListener.listener = listener_;

    return removeListener;
  }

  dispatch<EName extends keyof EMap & string>(
    type: EName,
    ...args: EMap[EName] extends undefined
      ? [detail?: EMap[EName], options?: Omit<CustomEventInit<EMap[EName]>, "detail">]
      : [detail: EMap[EName], options?: Omit<CustomEventInit<EMap[EName]>, "detail">]
  ) {
    const event = new CustomEvent(type, {
      ...args[1],
      detail: args[0],
    });
    return super.dispatchEvent(event);
  }

  /** @deprecated
   * use dispatch instead
   * */
  dispatchEvent = super.dispatchEvent.bind(this);
  /** @deprecated
   * use addListener instead
   * */
  addEventListener = super.addEventListener.bind(this);
  /** @deprecated
   * use method returned from addListener instead
   * */
  removeEventListener = super.removeEventListener.bind(this);
}
