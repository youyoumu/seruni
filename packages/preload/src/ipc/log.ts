import z from "zod";

const zToastPromiseOptions = z.object({
  loading: z.object({
    title: z.string(),
    description: z.string(),
  }),
  success: z.object({
    title: z.string(),
    description: z.string(),
  }),
  error: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

export type ToastPromiseOptions = z.infer<typeof zToastPromiseOptions>;

export const zLogIPC = {
  main: z.object({
    "log:send": z.object({
      input: z.tuple([
        z.object({
          context: z.record(z.string(), z.unknown()),
          message: z.string(),
          sequence: z.string(),
          time: z.number(),
          version: z.string(),
        }),
      ]),
      output: z.void(),
    }),
    "log:toast": z.object({
      input: z.tuple([
        z.object({
          title: z.string(),
          description: z.string(),
          type: z.enum(["info", "error", "warning", "success", "loading"]),
        }),
      ]),
      output: z.void(),
    }),
    "log:toastPromise": z.object({
      input: z.tuple([
        z.object({
          uuid: z.string(),
          loading: zToastPromiseOptions.shape.loading,
          error: zToastPromiseOptions.shape.error,
        }),
      ]),
      output: z.void(),
    }),
  }),

  renderer: z.object({
    "log:toastPromise": z.object({
      input: z.tuple([
        z.object({
          uuid: z.string(),
        }),
      ]),
      output: z.object({
        success: zToastPromiseOptions.shape.success,
      }),
    }),
  }),
};
