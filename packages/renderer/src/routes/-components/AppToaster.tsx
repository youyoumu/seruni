import { Toast } from "#/components/ui/toast";

export type ToastType = "info" | "error" | "warning" | "success" | "loading";

export const appToaster = Toast.createToaster({
  placement: "bottom-end",
  overlap: true,
  gap: 16,
});
