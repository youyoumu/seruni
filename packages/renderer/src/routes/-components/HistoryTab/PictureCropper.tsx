import { type SelectionData, zSelectionData } from "@repo/preload/ipc";
import Cropper from "cropperjs";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { css } from "styled-system/css";

export function PictureCropper(props: { src: string; editing: boolean }) {
  const [selectionData, setSelectionData] = createSignal<SelectionData>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [naturalSize, setNaturalSize] = createSignal<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
  const [isPreselect, setIsPreselect] = createSignal(true);
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

      if (props.editing && isPreselect()) {
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
        setIsPreselect(false);
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
      if (parsed.success) {
        const cropperImageRect = cropper
          ?.getCropperImage()
          ?.getBoundingClientRect();
        const maxSelection: SelectionData = {
          x: 0,
          y: 0,
          width: cropperImageRect?.width ?? 0,
          height: cropperImageRect?.height ?? 0,
        };
        if (!inSelection(parsed.data, maxSelection)) {
          e.preventDefault();
        } else {
          setSelectionData(parsed.data);
        }
      }
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
