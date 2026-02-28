const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function yyyyMMdd_HHmmss(date: Date) {
  const parts = Object.fromEntries(
    dateTimeFormat.formatToParts(date).map(({ type, value }) => [type, value]),
  );

  return `${parts.year}${parts.month}${parts.day}_${parts.hour}${parts.minute}${parts.second}`;
}
