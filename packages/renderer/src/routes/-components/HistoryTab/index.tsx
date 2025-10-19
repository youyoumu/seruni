import { usePagination } from "@ark-ui/solid";
import type { AnkiHistory } from "@repo/preload/ipc";
import { sort } from "fast-sort";
import { BirdIcon } from "lucide-solid";
import {
  createEffect,
  createSignal,
  For,
  Match,
  onCleanup,
  onMount,
  Switch,
} from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Flip } from "#/components/Flip";
import { Select_ } from "#/components/Form";
import { Pagination } from "#/components/ui/pagination";
import { createListCollection } from "#/components/ui/select";
import { Text } from "#/components/ui/text";
import { store } from "#/lib/store";
import { history, setHistory } from "./_util";
import { AnkiCard } from "./AnkiCard";

export function HistoryTab() {
  const [success, setSuccess] = createSignal(false);

  const [currentPage, setCurrentPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(20);
  const [slicedHistory, setSlicedHistory] = createSignal<AnkiHistory>([]);

  createEffect(() => {
    const count = history.length;
    const pagination = usePagination({
      count,
      pageSize: pageSize(),
      page: currentPage(),
    });
    setSlicedHistory(pagination().slice(history));
  });

  let id = setInterval(() => {});
  onMount(async () => {
    const { success, data } = await ipcRenderer.invoke("mining:getAnkiHistory");
    setSuccess(success);
    setHistory(sort(data).desc((item) => item.id));
    //TODO: use event listener
    id = setInterval(async () => {
      const { success, data } = await ipcRenderer.invoke(
        "mining:getAnkiHistory",
      );
      setSuccess(success);
      if (history.length !== data.length) {
        setHistory(sort(data).desc((item) => item.id));
      }
    }, 5000);
  });

  onCleanup(() => {
    clearInterval(id);
  });

  createEffect(async () => {
    if (store.client.anki.status === "connected") {
      const { success, data } = await ipcRenderer.invoke(
        "mining:getAnkiHistory",
      );
      setSuccess(success);
      setHistory(sort(data).desc((item) => item.id));
    }
  });

  const pageSizeItems = [5, 20, 40, 60].map((item) => ({
    label: item.toString(),
    value: item.toString(),
  }));

  return (
    <Stack h="full" maxW="8xl" mx="auto" gap="4">
      <Switch>
        <Match when={success()}>
          <Stack
            overflow="auto"
            class="custom-scrollbar"
            pe="4"
            gap="4"
            alignItems="center"
          >
            <For each={slicedHistory()}>
              {(item) => {
                return <AnkiCard noteId={item.id} />;
              }}
            </For>
          </Stack>
          <HStack justifyContent="center" gap="4">
            <Pagination
              justifyContent="center"
              count={history.length}
              pageSize={pageSize()}
              siblingCount={3}
              page={currentPage()}
              onPageChange={(page) => setCurrentPage(page.page)}
            />
            <Select_
              value={[pageSize().toString() ?? ""]}
              collection={createListCollection({
                items: pageSizeItems,
              })}
              onValueChange={(e) => {
                setPageSize(parseInt(e.items[0]?.value ?? "20"));
              }}
            />
          </HStack>
        </Match>
        <Match when={!success()}>
          <Stack alignItems="center" justifyContent="center" h="full">
            <Flip>
              <BirdIcon size={250} strokeWidth={1}></BirdIcon>
            </Flip>
            <Text size="2xl" color="fg.muted">
              Can't connect to Anki
            </Text>
          </Stack>
        </Match>
      </Switch>
    </Stack>
  );
}
