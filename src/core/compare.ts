import type { Comparator, JsonValue } from "./content-schema";

function canonical(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key] ?? null)}`)
    .join(",")}}`;
}

export function compareOutput(
  actual: JsonValue,
  expected: JsonValue,
  comparator: Comparator,
): boolean {
  if (comparator.kind === "numericTolerance") {
    return (
      typeof actual === "number" &&
      typeof expected === "number" &&
      Number.isFinite(actual) &&
      Number.isFinite(expected) &&
      Math.abs(actual - expected) <= comparator.tolerance
    );
  }
  if (comparator.kind === "unorderedArray") {
    if (
      !Array.isArray(actual) ||
      !Array.isArray(expected) ||
      actual.length !== expected.length
    )
      return false;
    return (
      JSON.stringify(actual.map(canonical).sort()) ===
      JSON.stringify(expected.map(canonical).sort())
    );
  }
  return canonical(actual) === canonical(expected);
}
