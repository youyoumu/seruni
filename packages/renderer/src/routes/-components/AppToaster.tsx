import { XIcon } from "lucide-solid";
import { Button } from "#/components/ui/button";
import { IconButton } from "#/components/ui/icon-button";
import { Toast } from "#/components/ui/toast";

export const appToaster = Toast.createToaster({
  placement: "bottom-end",
  overlap: true,
  gap: 16,
});

export function AppToaster() {
  return (
    <Toast.Toaster toaster={appToaster}>
      {(toast) => (
        <Toast.Root>
          <Toast.Title>{toast().title}</Toast.Title>
          <Toast.Description>{toast().description}</Toast.Description>
          <Toast.ActionTrigger
            asChild={(actionProps) => (
              <Button {...actionProps()} variant="link" size="sm">
                {toast().action?.label}
              </Button>
            )}
          />
          <Toast.CloseTrigger
            asChild={(closeProps) => (
              <IconButton {...closeProps()} size="sm" variant="link">
                <XIcon />
              </IconButton>
            )}
          />
        </Toast.Root>
      )}
    </Toast.Toaster>
  );
}
