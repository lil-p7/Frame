/**
 * Safe prop readers for renderers. Stored documents are validated on the
 * command path, but rendering must never crash on odd data — every reader
 * falls back to a sane default instead of casting blindly.
 */

export function stringProp(props: Record<string, unknown>, key: string, fallback: string): string {
  const value = props[key];
  return typeof value === "string" ? value : fallback;
}

export function numberProp(props: Record<string, unknown>, key: string, fallback: number): number {
  const value = props[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function booleanProp(
  props: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const value = props[key];
  return typeof value === "boolean" ? value : fallback;
}

export function enumProp<T extends string>(
  props: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = props[key];
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}
