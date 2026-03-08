import { formatDate } from "date-fns";

type Format = {
  (date: Date): string;
};

export const format: Format = (date: Date) => {
  return formatDate(date, "HH:mm:ss dd-MM-yyyy");
};
