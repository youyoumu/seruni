export type Command = {
  name: string;
  description?: string;
  shortcut?: string;
};

type GetAllCallback = (commands: Command[]) => void;
type CommandListener = (command: string) => void;

const listeners = new Set<CommandListener>();

export const commands = {
  getAll(callback: GetAllCallback) {
    callback([]);
  },

  onCommand: {
    addListener(listener: CommandListener) {
      listeners.add(listener);
    },
    removeListener(listener: CommandListener) {
      listeners.delete(listener);
    },
    hasListener(listener: CommandListener) {
      return listeners.has(listener);
    },
  },
};

export function _dispatchCommand(command: string) {
  for (const listener of listeners) {
    try {
      listener(command);
    } catch (err) {
      console.error("[chrome.commands] listener error", err);
    }
  }
}
