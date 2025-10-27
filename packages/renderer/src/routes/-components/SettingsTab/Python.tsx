import { ShieldAlertIcon } from "lucide-solid";
import { Grid, HStack, Stack } from "styled-system/jsx";
import { Alert } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Field } from "#/components/ui/field";
import { Heading } from "#/components/ui/heading";
import { SettingsMutation, SettingsQuery } from "#/lib/query/settings";
import { appToaster } from "../AppToaster";

export function Python() {
  const { PythonQuery } = SettingsQuery;
  const { PythonMutation } = SettingsMutation;
  const [pythonCommand, setPythonCommand] = createSignal("--version");

  const isPythonInstalledQuery = PythonQuery.isInstalled.use();
  const isPythonInstalled = () => isPythonInstalledQuery.data === true;
  const isUvInstalledQuery = PythonQuery.isUvInstalled.use();
  const isUvInstalled = () => isUvInstalledQuery.data === true;
  const isVenvDependenciesInstalledQuery =
    PythonQuery.venvDependenciesInstalled.use();
  const isVenvDependenciesInstalled = () =>
    isVenvDependenciesInstalledQuery.data === true;

  function getAlertDescription() {
    if (!isPythonInstalled()) return "Python is not installed";
    if (!isUvInstalled()) return "Uv is not installed";
    if (!isVenvDependenciesInstalled())
      return "Dependencies are not installed or broken";
  }

  function isPythonOk() {
    return (
      isPythonInstalled() && isUvInstalled() && isVenvDependenciesInstalled()
    );
  }

  const installPythonMutation = PythonMutation.installPython();
  const installPythonUvMutation = PythonMutation.installUv();
  const installPythonDependenciesMutation =
    PythonMutation.installDependencies();

  const isInstalling = () =>
    installPythonMutation.isPending ||
    installPythonUvMutation.isPending ||
    installPythonDependenciesMutation.isPending;

  function installPython() {
    const isReinstall = isPythonInstalled();
    const toastId = appToaster.loading({
      title: isReinstall ? "Reinstalling Python..." : "Installing Python...",
    });
    installPythonMutation.mutate(undefined, {
      onSuccess: () => {
        appToaster.update(toastId, {
          title: isReinstall
            ? "Python has been reinstalled"
            : "Python has been installed",
          duration: Infinity,
          action: {
            label: "Install uv",
            onClick: () => installPythonUv(),
          },
          type: "success",
        });
      },
      onError: () => {
        appToaster.update(toastId, {
          title: "Failed to install Python",
          type: "error",
        });
      },
    });
  }

  function installPythonUv() {
    const isReinstall = isUvInstalled();
    const toastId = appToaster.loading({
      title: isUvInstalled() ? "Reinstalling uv" : "Installing uv",
    });
    installPythonUvMutation.mutate(undefined, {
      onSuccess: () => {
        appToaster.update(toastId, {
          title: isReinstall
            ? "uv has been reinstalled"
            : "uv has been installed",
          duration: Infinity,
          action: {
            label: "Install Dependencies",
            onClick: () => installPythonDependencies(),
          },
          type: "success",
        });
      },
      onError: () => {
        appToaster.update(toastId, {
          title: "Failed to install uv",
          type: "error",
        });
      },
    });
  }

  function installPythonDependencies() {
    const isReinstall = isVenvDependenciesInstalled();
    const toastId = appToaster.loading({
      title: isReinstall
        ? "Reinstalling Python dependencies"
        : "Installing Python dependencies",
    });
    installPythonDependenciesMutation.mutate(undefined, {
      onSuccess: () => {
        appToaster.update(toastId, {
          title: isReinstall
            ? "Python dependencies have been reinstalled"
            : "Python dependencies have been installed",
          duration: 30000,
          type: "success",
        });
      },
      onError: () => {
        appToaster.update(toastId, {
          title: "Failed to install Python dependencies",
          type: "error",
        });
      },
    });
  }

  return (
    <Suspense>
      <Stack gap="2" w="full">
        <Stack>
          <Heading
            size="2xl"
            borderBottomColor="border.default"
            borderBottomWidth="medium"
            pb="2"
          >
            Python
          </Heading>
        </Stack>
        <Show when={!isPythonOk()}>
          <Alert.Root>
            <Alert.Icon
              color="yellow.dark.a10"
              asChild={(props) => {
                return <ShieldAlertIcon {...props()} />;
              }}
            ></Alert.Icon>
            <Alert.Content>
              <Alert.Title>Python is not ready to use</Alert.Title>
              <Alert.Description>{getAlertDescription()}</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        </Show>
        <Field.Root>
          <Field.Label>Python Command</Field.Label>
          <HStack>
            <Field.Input
              placeholder="--version"
              value={pythonCommand()}
              onChange={(e) => {
                setPythonCommand(e.target.value);
              }}
            />
            <Button
              disabled={!isPythonInstalled() || isInstalling()}
              onClick={() => {
                const params = pythonCommand().split(" ");
                let result: { stdout: string; stderr: string } | undefined;
                appToaster.promise(
                  ipcRenderer
                    .invoke("settings:runPython", [...params])
                    .then((result_) => {
                      result = result_;
                    }),
                  {
                    loading: {
                      title: "Running Python...",
                      description: pythonCommand(),
                    },
                    error: () => ({
                      title: "Python command failed",
                      description: result?.stderr ?? "Unknown Error",
                    }),
                    success: () => ({
                      title: "Python command succeeded",
                      description: result?.stdout ?? "",
                    }),
                  },
                );
              }}
            >
              Run
            </Button>
          </HStack>
        </Field.Root>
        <Grid
          gap="4"
          gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))"
          alignItems="end"
        >
          <Button
            loading={isInstalling()}
            onClick={() => {
              installPython();
            }}
          >
            {isPythonInstalled() ? "Reinstall" : "Install"} Python
          </Button>
          <Button
            disabled={!isPythonInstalled()}
            loading={isInstalling()}
            onClick={() => {
              installPythonUv();
            }}
          >
            {isUvInstalled() ? "Reinstall" : "Install"} uv
          </Button>
          <Button
            disabled={!isPythonInstalled() || !isUvInstalled()}
            loading={isInstalling()}
            onClick={() => {
              installPythonDependencies();
            }}
          >
            {isVenvDependenciesInstalled() ? "Reinstall" : "Install"}{" "}
            Dependencies
          </Button>
        </Grid>
      </Stack>
    </Suspense>
  );
}
