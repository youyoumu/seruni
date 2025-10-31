import { createEffect } from "solid-js";

export const inspect = (accessor: () => unknown) => {
  createEffect(() => {
    console.log(accessor());
  });
};
