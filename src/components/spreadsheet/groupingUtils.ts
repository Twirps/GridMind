// Pure helpers for row/column outline grouping (Excel-style)
export interface OutlineGroup {
  start: number;
  end: number;
  level: number;
  collapsed: boolean;
}

const MAX_LEVEL = 8;

export function addGroup(
  groups: OutlineGroup[] | undefined,
  start: number,
  end: number
): OutlineGroup[] {
  const list = groups ? [...groups] : [];
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);

  // Avoid exact duplicates
  if (list.some((g) => g.start === lo && g.end === hi)) return list;

  // Level = how many existing groups fully contain this new one + 1
  const containing = list.filter((g) => g.start <= lo && g.end >= hi).length;
  const level = Math.min(containing, MAX_LEVEL - 1);

  list.push({ start: lo, end: hi, level, collapsed: false });
  // Sort by start asc, end desc so larger groups render first
  list.sort((a, b) => a.start - b.start || b.end - a.end);
  return list;
}

export function removeGroupsInRange(
  groups: OutlineGroup[] | undefined,
  start: number,
  end: number
): OutlineGroup[] {
  if (!groups) return [];
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  // Remove groups that lie entirely inside the selected range
  return groups.filter((g) => !(g.start >= lo && g.end <= hi));
}

export function toggleGroup(
  groups: OutlineGroup[] | undefined,
  index: number
): OutlineGroup[] {
  if (!groups) return [];
  return groups.map((g, i) =>
    i === index ? { ...g, collapsed: !g.collapsed } : g
  );
}

export function isHidden(
  index: number,
  groups: OutlineGroup[] | undefined
): boolean {
  if (!groups || groups.length === 0) return false;
  return groups.some(
    (g) => g.collapsed && index >= g.start && index <= g.end
  );
}

export function getMaxLevel(groups: OutlineGroup[] | undefined): number {
  if (!groups || groups.length === 0) return -1;
  return groups.reduce((m, g) => Math.max(m, g.level), 0);
}
