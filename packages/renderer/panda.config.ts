import { defineConfig } from "@pandacss/dev";
import { createPreset } from "@park-ui/panda-preset";

import amber from "@park-ui/panda-preset/colors/amber";
import blue from "@park-ui/panda-preset/colors/blue";
import bronze from "@park-ui/panda-preset/colors/bronze";
import brown from "@park-ui/panda-preset/colors/brown";
import crimson from "@park-ui/panda-preset/colors/crimson";
import cyan from "@park-ui/panda-preset/colors/cyan";
import gold from "@park-ui/panda-preset/colors/gold";
import grass from "@park-ui/panda-preset/colors/grass";
import green from "@park-ui/panda-preset/colors/green";
import indigo from "@park-ui/panda-preset/colors/indigo";
import iris from "@park-ui/panda-preset/colors/iris";
import jade from "@park-ui/panda-preset/colors/jade";
import lime from "@park-ui/panda-preset/colors/lime";
import mint from "@park-ui/panda-preset/colors/mint";
import neutral from "@park-ui/panda-preset/colors/neutral";
import orange from "@park-ui/panda-preset/colors/orange";
import pink from "@park-ui/panda-preset/colors/pink";
import plum from "@park-ui/panda-preset/colors/plum";
import purple from "@park-ui/panda-preset/colors/purple";
import red from "@park-ui/panda-preset/colors/red";
import ruby from "@park-ui/panda-preset/colors/ruby";
import sand from "@park-ui/panda-preset/colors/sand";
import sky from "@park-ui/panda-preset/colors/sky";
import teal from "@park-ui/panda-preset/colors/teal";
import tomato from "@park-ui/panda-preset/colors/tomato";
import violet from "@park-ui/panda-preset/colors/violet";
import yellow from "@park-ui/panda-preset/colors/yellow";

// Put all imported colors into one object
const allColors = {
  amber,
  blue,
  bronze,
  brown,
  crimson,
  cyan,
  gold,
  grass,
  green,
  indigo,
  iris,
  jade,
  lime,
  mint,
  neutral,
  orange,
  pink,
  plum,
  purple,
  red,
  ruby,
  sand,
  sky,
  teal,
  tomato,
  violet,
  yellow,
};

const tokens = Object.fromEntries(
  Object.entries(allColors).map(([name, color]) => [name, color.tokens]),
);

// Convert them to semanticTokens
const semanticTokens = Object.fromEntries(
  Object.entries(allColors).map(([name, color]) => [
    name,
    color.semanticTokens,
  ]),
);

export default defineConfig({
  // Whether to use css reset
  preflight: true,

  // Where to look for your css declarations
  include: ["./src/**/*.{js,jsx,ts,tsx}"],

  // Files to exclude
  exclude: ["node_modules", "dist"],

  // Useful for theme customization
  theme: {
    extend: {
      tokens: {
        fonts: {
          nunito: { value: "var(--font-nunito)" },
          jetbrainsMono: { value: "var(--font-jetbrainsMono)" },
        },
        colors: {
          ...tokens,
        },
        animations: {
          spin: {
            value: "spin 1s linear infinite",
          },
        },
      },
      semanticTokens: {
        colors: {
          ...semanticTokens,
        },
      },
    },
    slotRecipes: {
      //@ts-expect-error
      drawer: {
        jsx: [/^Drawer.*/],
      },

      //@ts-expect-error
      dialog: {
        jsx: [/^Dialog.*/],
      },

      //@ts-expect-error
      tabs: {
        jsx: [/^Tabs.*/],
      },
    },
  },

  // The output directory for your css system
  outdir: "styled-system",
  strictTokens: true,
  jsxFramework: "solid",
  presets: [
    createPreset({ accentColor: amber, grayColor: sand, radius: "sm" }),
  ],
});
