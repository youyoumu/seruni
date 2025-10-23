type State = Record<string, any>;
class HMR {
  #state = new Map<symbol, State>();

  /**
   * Ensures the state for a given key exists.
   */
  #ensure<T extends State>(key: symbol, initial?: T): T {
    if (!this.#state.has(key)) this.#state.set(key, initial ?? {});
    const state = this.#state.get(key);
    if (!state) throw new Error("State not found");
    return this.#state.get(key) as T;
  }

  /**
   * Create or retrieve a persisted state by symbol.
   */
  createState<T extends State>(key: symbol, initial?: T) {
    const state = this.#ensure<T>(key, initial);

    const get = () => state;
    const set = (next: Partial<T>) => {
      Object.assign(state, next);
    };

    return [get, set] as const;
  }

  /**
   * Clear specific or all HMR states.
   */
  clear(key?: symbol) {
    if (key) this.#state.delete(key);
    else this.#state.clear();
  }
}

declare global {
  var hmr: HMR;
}
if (!window.hmr) window.hmr = new HMR();
