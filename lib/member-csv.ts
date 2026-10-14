/** Strict RFC-style CSV parsing; limits apply before any database writes. */
export function parseMemberCsv(source: string) {
  if (source.length > 1024 * 1024)
    throw Error("CSV must be smaller than 1 MB.");
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"') {
      if (field || closed) throw Error("Invalid CSV quoting.");
      quoted = true;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(field.trim());
      field = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else {
      if (closed && !/\s/.test(c))
        throw Error("Unexpected text after a quoted CSV field.");
      field += c;
    }
  }
  if (quoted) throw Error("Unclosed CSV quote.");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift()?.map((v) => v.toLowerCase());
  const allowed = ["full_name", "email", "phone", "member_number"];
  if (
    !headers?.includes("full_name") ||
    headers.some((h) => !allowed.includes(h)) ||
    new Set(headers).size !== headers.length
  )
    throw Error(
      "Use unique headers: full_name, email, phone, member_number. Full name is required.",
    );
  if (!rows.length || rows.length > 500)
    throw Error("Import between 1 and 500 members per file.");
  return rows.map((values, i) => {
    if (values.length !== headers.length)
      throw Error(`CSV row ${i + 2} has the wrong number of columns.`);
    return Object.fromEntries(headers.map((h, j) => [h, values[j]]));
  });
}
