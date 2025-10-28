import { usePagination } from "@ark-ui/solid";
import { useQueryClient } from "@tanstack/solid-query";
import { BirdIcon, PickaxeIcon } from "lucide-solid";
import { css } from "styled-system/css";
import { HStack, Stack } from "styled-system/jsx";
import { Flip } from "#/components/Flip";
import { Select_ } from "#/components/Form";
import { Pagination } from "#/components/ui/pagination";
import { createListCollection } from "#/components/ui/select";
import { Text } from "#/components/ui/text";
import { keyStore } from "#/lib/query/_util";
import { GeneralQuery } from "#/lib/query/queryGeneral";
import { MiningQuery } from "#/lib/query/queryMining";
import { AnkiCard } from "./AnkiCard";
import { NoteContextProvider } from "./Context";

export function HistoryTab() {
  const queryClient = useQueryClient();
  const { ClientStatusQuery } = GeneralQuery;
  const clientStatusQuery = ClientStatusQuery.detail.use();
  const ankiHistoryQuery = MiningQuery.AnkiQuery.history.use();

  const [currentPage, setCurrentPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(20);
  const slicedHistory = () => {
    ankiHistoryQuery.dataUpdatedAt;
    const count = ankiHistoryQuery.data.length;
    const pagination = usePagination({
      count,
      pageSize: pageSize(),
      page: currentPage(),
    });
    return pagination().slice(ankiHistoryQuery.data);
  };

  createEffect(async () => {
    if (clientStatusQuery.data.anki === "connected") {
      queryClient.invalidateQueries({
        queryKey: keyStore["mining:ankiHistory"].all.queryKey,
      });
    }
  });

  const pageSizeItems = [5, 20, 40, 60].map((item) => ({
    label: item.toString(),
    value: item.toString(),
  }));

  let containerEl: HTMLDivElement | undefined;

  return (
    <Suspense>
      <Stack h="full" maxW="8xl" mx="auto" gap="4">
        <Switch>
          <Match when={ankiHistoryQuery.isError || !ankiHistoryQuery.isEnabled}>
            <Stack alignItems="center" justifyContent="center" h="full">
              <Flip>
                <BirdIcon
                  size={250}
                  strokeWidth={1}
                  class={css({
                    color: "fg.muted",
                  })}
                />
              </Flip>
              <Text size="2xl" color="fg.muted">
                Can't connect to Anki
              </Text>
            </Stack>
          </Match>
          <Match when={ankiHistoryQuery.data.length === 0}>
            <Stack alignItems="center" justifyContent="center" h="full">
              <Flip>
                <PickaxeIcon
                  size={250}
                  strokeWidth={1}
                  class={css({
                    color: "fg.muted",
                  })}
                />
              </Flip>
              <Text size="2xl" color="fg.muted">
                History is empty
              </Text>
            </Stack>
          </Match>
          <Match when={ankiHistoryQuery.isSuccess}>
            <Stack
              ref={containerEl}
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
                onPageChange={(page) => {
                  setCurrentPage(page.page);
                  containerEl?.scrollTo({
                    top: 0,
                  });
                }}
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
