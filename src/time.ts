const italianDateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Rome"
});

export function timestampForFile(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function formatItalianDateTime(isoDate: string): string {
  return italianDateTimeFormatter.format(new Date(isoDate));
}
