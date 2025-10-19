import { ShieldAlertIcon } from "lucide-solid";
import { createSignal, onMount, Show } from "solid-js";
import { Grid, HStack, Stack } from "styled-system/jsx";
import { Alert } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Field } from "#/components/ui/field";
import { Heading } from "#/components/ui/heading";
import { store } from "#/lib/store";
import { checkPython } from "#/lib/util";
import { appToaster } from "../AppToaster";

export function Python() {
  const [isInstalling, setIsInstalling] = createSignal(false);
  const [pythonCommand, setPythonCommand] = createSignal("--version");

  const isInstalled = () => store.debug.python.isInstalled;
  const isUvInstalled = () => store.debug.python.isUvInstalled;
  const isDependencyInstalled = () => store.debug.python.isDependencyInstalled;

  function getAlertDescription() {
    if (!isInstalled()) return "Python is not installed";
    if (!isUvInstalled()) return "Uv is not installed";
    if (!isDependencyInstalled())
      return "Dependencies are not installed or broken";
  }

  function isPythonOk() {
    return isInstalled() && isUvInstalled() && isDependencyInstalled();
  }

  function installPythonUv() {
    appToaster.promise(
      ipcRenderer
        .invoke("settings:installPythonUv")
        .then(() => {
          ipcRenderer.invoke("settings:inPythonInstalled");
        })
        .finally(() => {
          checkPython();
          setIsInstalling(false);
        }),
      {
        loading: {
          title: isUvInstalled() ? "Reinstalling uv" : "Installing uv",
        },
        error: {
          title: "Failed to install uv",
        },
        success: {
          title: isUvInstalled()
            ? "uv has been reinstalled"
            : "uv has been installed",
          duration: Infinity,
          action: {
            label: "Install Dependencies",
            onClick: () => installPythonDependencies(),
          },
        },
      },
    );
  }

  function installPythonDependencies() {
    appToaster.promise(
      ipcRenderer
        .invoke("settings:installPythonDependencies")
        .then(() => {
          ipcRenderer.invoke("settings:installPythonDependencies");
        })
        .finally(() => {
          checkPython();
          setIsInstalling(false);
        }),
      {
        loading: {
          title: isDependencyInstalled()
            ? "Reinstalling Python dependencies"
            : "Installing Python dependencies",
        },
        error: {
          title: "Failed to install Python dependencies",
        },
        success: {
          title: isDependencyInstalled()
            ? "Python dependencies have been reinstalled"
            : "Python dependencies have been installed",
          duration: 30000,
        },
      },
    );
  }

  onMount(async () => {
    checkPython();
  });

  return (
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
            disabled={!isInstalled() || isInstalling()}
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
            setIsInstalling(true);
            appToaster.promise(
              ipcRenderer
                .invoke("settings:installPython")
                .then(() => {
                  ipcRenderer.invoke("settings:inPythonInstalled");
                })
                .finally(() => {
                  checkPython();
                  setIsInstalling(false);
                }),
              {
                loading: {
                  title: isInstalled()
                    ? "Reinstalling Python..."
                    : "Installing Python...",
                },
                error: {
                  title: "Failed to install Python",
                },
                success: {
                  title: isInstalled()
                    ? "Python has been reinstalled"
                    : "Python has been installed",
                  duration: Infinity,
                  action: {
                    label: "Install uv",
                    onClick: () => installPythonUv(),
                  },
                },
              },
            );
          }}
        >
          {isInstalled() ? "Reinstall" : "Install"} Python
        </Button>
        <Button
          disabled={!isInstalled()}
          loading={isInstalling()}
          onClick={() => {
            setIsInstalling(true);
            installPythonUv();
          }}
        >
          {isUvInstalled() ? "Reinstall" : "Install"} uv
        </Button>
        <Button
          disabled={!isInstalled() || !isUvInstalled()}
          loading={isInstalling()}
          onClick={() => {
            setIsInstalling(true);
            installPythonDependencies();
          }}
        >
          {isDependencyInstalled() ? "Reinstall" : "Install"} Dependencies
        </Button>
      </Grid>
    </Stack>
  );
}
