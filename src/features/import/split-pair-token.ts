/** Split a combined pair label (e.g. from Excel) into two display tokens. */
export function splitPairToken(value: string | null | undefined): [string, string] {
  if (!value || value === "—") {
    return ["—", "—"];
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  const parts = normalized
    .split(/\s*(?:\+|\/|&| und )\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return [parts[0] ?? "—", parts[1] ?? "—"];
  }

  return [normalized, "—"];
}
