export const fonts = [
  "Noto Sans JP",
  "Noto Serif JP",
  "Kosugi Maru",
  "M PLUS Rounded 1c",
  "Sawarabi Mincho",
];

export function loadGoogleFont(
  fontName: string | undefined,
  weights: number[] = [400],
) {
  if (!fontName) {
    return;
  }
  const weightParam = `:wght@${weights.join(";")}`;
  const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    fontName,
  )}${weightParam}&display=swap`;

  // Remove previous links
  document.querySelectorAll("link[data-dynamic-font]").forEach((el) => {
    el.remove();
  });

  // Inject new link
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = fontUrl;
  link.setAttribute("data-dynamic-font", "true");
  document.head.appendChild(link);
}
