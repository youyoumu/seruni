import { usePagination } from "@ark-ui/solid";
import type { AnkiHistory } from "@repo/preload/ipc";
import { useQueryClient } from "@tanstack/solid-query";
import { BirdIcon } from "lucide-solid";
import {
  createEffect,
  createSignal,
  For,
  Match,
  onMount,
  Suspense,
  Switch,
} from "solid-js";
import { HStack, Stack } from "styled-system/jsx";
import { Flip } from "#/components/Flip";
import { Select_ } from "#/components/Form";
import { Pagination } from "#/components/ui/pagination";
import { createListCollection } from "#/components/ui/select";
import { Text } from "#/components/ui/text";
import { keyStore } from "#/lib/query/_util";
import { GeneralQuery } from "#/lib/query/general";
import { MiningQuery } from "#/lib/query/mining";
import { AnkiCard } from "./AnkiCard";
import { NoteContextProvider } from "./Context";

export function HistoryTab() {
  const queryClient = useQueryClient();
  const { ClientStatusQuery } = GeneralQuery;
  const clientStatusQuery = ClientStatusQuery.detail.use();
  const ankiHistoryQuery = MiningQuery.AnkiHistoryQuery.data.use();

  const [currentPage, setCurrentPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(20);
  const [slicedHistory, setSlicedHistory] = createSignal<AnkiHistory>([]);

  createEffect(() => {
    const count = ankiHistoryQuery.data.length;
    const pagination = usePagination({
      count,
      pageSize: pageSize(),
      page: currentPage(),
    });
    setSlicedHistory(pagination().slice(ankiHistoryQuery.data));
  });

  onMount(async () => {});

  createEffect(async () => {
    if (clientStatusQuery.data.anki === "connected") {
      queryClient.invalidateQueries({
        queryKey: keyStore["mining:ankiHistory"].all.queryKey,
      });
    }
  });

  createEffect(() => {});

  const pageSizeItems = [5, 20, 40, 60].map((item) => ({
    label: item.toString(),
    value: item.toString(),
  }));

  return (
    <Suspense>
      <Stack h="full" maxW="8xl" mx="auto" gap="4">
        <Switch>
          <Match when={ankiHistoryQuery.isError || !ankiHistoryQuery.isEnabled}>
            <Stack alignItems="center" justifyContent="center" h="full">
              <Flip>
                <BirdIcon size={250} strokeWidth={1}></BirdIcon>
              </Flip>
              <Text size="2xl" color="fg.muted">
                Can't connect to Anki
              </Text>
            </Stack>
          </Match>
          <Match when={ankiHistoryQuery.isSuccess}>
            <Stack
              overflow="auto"
              class="custom-scrollbar"
              pe="4"
              gap="4"
              alignItems="center"
            >
              <For each={slicedHistory()}>
                {(item) => {
                  return (
                    <NoteContextProvider value={item}>
                      <AnkiCard />
                    </NoteContextProvider>
                  );
                }}
              </For>
            </Stack>
            <HStack justifyContent="center" gap="4">
              <Pagination
                justifyContent="center"
                count={ankiHistoryQuery.data.length}
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
        </Switch>
      </Stack>
    </Suspense>
  );
}
