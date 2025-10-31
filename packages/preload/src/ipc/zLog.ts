import z from "zod";

const zLogMessage = z.object({
  context: z.record(z.string(), z.unknown()),
  message: z.string(),
  sequence: z.string(),
  time: z.number(),
  version: z.string(),
});

const zToastPromiseOptions = z.object({
  loading: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  }),
  success: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    action: z
      .object({
        label: z.string(),
        id: z.string(),
      })
      .optional(),
  }),
  error: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  }),
});

export type LogMessage = z.infer<typeof zLogMessage>;

export type ToastPromiseOptions = z.infer<typeof zToastPromiseOptions>;
export type ToastPromiseOptionsLoading = {
  loading: ToastPromiseOptions["loading"];
};
export type ToastPromiseOptionsError = {
  error: ToastPromiseOptions["error"];
};
export type ToastPromiseOptionsSuccess = {
  success: ToastPromiseOptions["success"];
};

export const zLogIPC = {
  main: z.object({
    "log:send": z.object({
      input: z.tuple([zLogMessage]),
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
        success: zToastPromiseOptions.shape.success.optional(),
        error: zToastPromiseOptions.shape.error.optional(),
      }),
    }),
    "log:invokeAction": z.object({
      input: z.tuple([z.object({ id: z.string() })]),
      output: z.void(),
    }),
  }),
};
