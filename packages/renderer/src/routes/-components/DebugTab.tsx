import { useQuery, useQueryClient } from "@tanstack/solid-query";
import { format } from "date-fns";
import {
  type Component,
  createEffect,
  createSignal,
  getOwner,
  on,
  onMount,
  runWithOwner,
  Suspense,
  untrack,
} from "solid-js";
import { Grid, Stack } from "styled-system/jsx";
import { Button } from "#/components/ui/button";

function useOwner<T>(fn: () => T): T {
  const owner = getOwner();
  return runWithOwner(owner, fn) as T;
}

export function DebugTab() {
  const queryClient = useQueryClient();
  const owner = getOwner();
  if (!owner) throw new Error("owner not found");

  const query = useQuery(() => {
    const query2 = useQuery(() => ({
      queryKey: ["test2"],
      queryFn: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return format(new Date(), "ss");
      },
    }));
    query2.isStale;
    return {
      queryKey: ["test"],
      queryFn: () => format(new Date(), "hh mm ss"),
      select: (data) => `${data}_${query2.data}`,
    };
  });

  onMount(() => {});

  createEffect(() => {});

  return (
    <Suspense>
      <Stack gap="4" maxW="8xl" mx="auto">
        <Grid
          gap="2"
          gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))"
        >
          <Button
            onClick={() => {
              queryClient.invalidateQueries({
                queryKey: ["test"],
              });
              queryClient.invalidateQueries({
                queryKey: ["test2"],
              });
            }}
          >
            Test
          </Button>
        </Grid>
        <Stack>
          {query.data}
          <WithChildren
            theChildren={() => {
              return (
                <Button
                  onClick={() => {
                    log(query.data ?? "");
                  }}
                >
                  {query.data}
                </Button>
              );
            }}
          />
        </Stack>
      </Stack>
    </Suspense>
  );
}

export function WithChildren(props: { theChildren: Component }) {
  return <>{props.theChildren}</>;
}
