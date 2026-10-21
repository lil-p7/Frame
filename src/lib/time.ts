/**
 * Formats an ISO timestamp as a short relative time ("just now", "5m ago",
 * "3h ago", "2d ago"), falling back to a locale date for older projects.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) {
    return "unknown time";
  }

  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.round(diffMs / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(then);
}
