import type { ListCollection } from "@ark-ui/solid";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-solid";
import { For } from "solid-js";
import { Select } from "./ui/select";

export function Select_(
  props: Select.RootProps & {
    collection: ListCollection;
    label?: string;
    itemGroupLabel?: string;
    placeholder?: string;
  },
) {
  return (
    <Select.Root
      positioning={{ sameWidth: true }}
      width="2xs"
      {...props}
      collection={props.collection}
    >
      <Select.Label>{props.label}</Select.Label>
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder={props.placeholder} />
          <ChevronsUpDownIcon />
        </Select.Trigger>
      </Select.Control>
      <Select.Positioner>
        <Select.Content>
          <Select.ItemGroup>
            {/* <Select.ItemGroupLabel> */}
            {/*   {props.itemGroupLabel} */}
            {/* </Select.ItemGroupLabel> */}
            <For each={props.collection.items}>
              {(item) => (
                <Select.Item item={item}>
                  <Select.ItemText>{item.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <CheckIcon />
                  </Select.ItemIndicator>
                </Select.Item>
              )}
            </For>
          </Select.ItemGroup>
        </Select.Content>
      </Select.Positioner>
    </Select.Root>
  );
}
