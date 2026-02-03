import { createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => {
  return {
    // Disable SSR by default
    defaultSsr: false,
  };
});
