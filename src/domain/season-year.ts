export function extractSeasonYearFromLabel(label: string): number | null {
  const explicit = label.match(/\b(19|20)\d{2}\b/);
  return explicit ? Number(explicit[0]) : null;
}

export function resolveSeasonYear(label: string, createdAt: string): number {
  const explicit = extractSeasonYearFromLabel(label);
  if (explicit != null) {
    return explicit;
  }

  const created = new Date(createdAt);
  if (!Number.isNaN(created.getTime())) {
    return created.getFullYear();
  }
  return new Date().getFullYear();
}
