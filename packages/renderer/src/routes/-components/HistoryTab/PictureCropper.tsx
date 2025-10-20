import { type SelectionData, zSelectionData } from "@repo/preload/ipc";
import Cropper from "cropperjs";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { css } from "styled-system/css";

export function PictureCropper(props: {
  src: string;
  editing: boolean;
  onSelectionChange: (details: { selectionData: SelectionData }) => void;
}) {
  const [selectionData, setSelectionData] = createSignal<SelectionData>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  createEffect(() => {
    props.onSelectionChange?.({ selectionData: selectionData() });
  });
  const [naturalSize, setNaturalSize] = createSignal<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
  const image = new Image();
  image.alt = "Picture";
  image.src = props.src;
  let cropperContainer: HTMLDivElement | undefined;
  let cropper: Cropper | undefined;

  function inSelection(selection: SelectionData, maxSelection: SelectionData) {
    return (
      selection.x >= maxSelection.x &&
      selection.y >= maxSelection.y &&
      selection.x + selection.width <= maxSelection.x + maxSelection.width &&
      selection.y + selection.height <= maxSelection.y + maxSelection.height
    );
  }

  const abortController = new AbortController();

  createEffect(() => {
    image.src = props.src;
    cropper = new Cropper(image, {
      container: cropperContainer,
    });

    const listener1 = (e: Event) => {
      const image = e.target as HTMLImageElement;
      setNaturalSize({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.addEventListener("load", listener1);

    const centerImage = () => {
      const cropperImage = cropper?.getCropperImage();
      cropperImage?.$center("contain");

      if (props.editing) {
        const cropperSelection = cropper?.getCropperSelection();
        const rect = cropperImage?.getBoundingClientRect();
        if (!rect) return;

        // rendered (scaled) width/height, not natural
        const w = rect.width;
        const h = rect.height;

        // target crop size (50% of displayed image)
        const cropWidth = w * 0.5;
        const cropHeight = h * 0.5;

        // centered position
        const cropX = (w - cropWidth) / 2;
        const cropY = (h - cropHeight) / 2;

        cropperSelection?.$change(cropX, cropY, cropWidth, cropHeight);
      }
    };
    const observer = new ResizeObserver(centerImage);
    const cropperImage = cropper.getCropperImage();
    if (cropperImage) observer.observe(cropperImage);
    window.addEventListener("resize", centerImage);

    const listener2 = (e: Event) => {
      cropper?.getCropperImage()?.$center("contain");
      const parsed = zSelectionData.safeParse(
        (e as Event & { detail: unknown }).detail,
      );
      if (!parsed.success) return;

      const cropperImage = cropper?.getCropperImage();
      const cropperImageRect = cropperImage?.getBoundingClientRect();
      if (!cropperImageRect) return;

      const maxSelection: SelectionData = {
        x: 0,
        y: 0,
        width: cropperImageRect.width,
        height: cropperImageRect.height,
      };

      if (!inSelection(parsed.data, maxSelection)) {
        e.preventDefault();
        return;
      }

      // ✅ Convert displayed → natural pixel coordinates for FFmpeg
      const scaleX = image.naturalWidth / cropperImageRect.width;
      const scaleY = image.naturalHeight / cropperImageRect.height;
      const realSelection = {
        x: parsed.data.x * scaleX,
        y: parsed.data.y * scaleY,
        width: parsed.data.width * scaleX,
        height: parsed.data.height * scaleY,
      };

      // Update displayed selection
      setSelectionData(realSelection);
    };

    cropper.getCropperSelection()?.addEventListener("change", listener2);

    abortController.signal.addEventListener("abort", () => {
      image.removeEventListener("load", listener1);
      cropper?.getCropperSelection()?.removeEventListener("change", listener2);
      observer.disconnect();
      window.removeEventListener("resize", centerImage);
    });

    onCleanup(() => {
      cropper?.getCropperCanvas()?.remove();
      abortController.abort();
    });
  });

  return (
    <div
      ref={cropperContainer}
      class={css({
        maxW: "full",
        rounded: "md",
        shadow: "md",
        "& > cropper-canvas": {
          height: "full",
          width: "full",
        },
        "& > cropper-canvas > cropper-image": {
          height: "full",
          width: "full",
        },
      })}
      style={{
        width: `${naturalSize().width}px`,
        "aspect-ratio": `${naturalSize().width} / ${naturalSize().height}`,
        height: "auto",
      }}
    ></div>
  );
}
