export function eventCalendar(
  event: {
    id: string;
    title: string;
    starts_at: string;
    location?: string;
    description?: string;
  },
  now = new Date(),
) {
  const escape = (value: string) =>
    value
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n|\r/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NADORIO//Events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escape(event.id)}@nadorio`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(new Date(event.starts_at))}`,
    `SUMMARY:${escape(event.title)}`,
    `LOCATION:${escape(event.location || "")}`,
    `DESCRIPTION:${escape(event.description || "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // RFC 5545 folds by UTF-8 octets without splitting a code point.
  return (
    lines
      .map((line) => {
        let output = "",
          bytes = 0;
        for (const char of line) {
          const size = new TextEncoder().encode(char).length;
          if (bytes + size > 75) {
            output += "\r\n ";
            bytes = 1;
          }
          output += char;
          bytes += size;
        }
        return output;
      })
      .join("\r\n") + "\r\n"
  );
}
export function downloadCalendar(event: Parameters<typeof eventCalendar>[0]) {
  const url = URL.createObjectURL(
    new Blob([eventCalendar(event)], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "nadorio-event.ics";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
