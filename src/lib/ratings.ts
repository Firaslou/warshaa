export type RatingSummary = { average: number; count: number };

export function aggregateRatings<T extends Record<string, unknown>>(
  rows: T[],
  idKey: keyof T,
): Record<string, RatingSummary> {
  const totals: Record<string, { total: number; count: number }> = {};

  rows.forEach((row) => {
    const id = String(row[idKey] ?? "");
    const rating = Number(row.rating);
    if (!id || !Number.isFinite(rating)) return;
    const current = totals[id] ?? { total: 0, count: 0 };
    totals[id] = { total: current.total + rating, count: current.count + 1 };
  });

  return Object.fromEntries(
    Object.entries(totals).map(([id, value]) => [
      id,
      { average: value.total / value.count, count: value.count },
    ]),
  );
}
