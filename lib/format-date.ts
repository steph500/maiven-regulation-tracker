const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
export function formatDate(value: string): string {
  return dateFormat.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}
