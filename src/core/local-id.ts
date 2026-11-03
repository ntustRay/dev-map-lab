type Entropy = {
  randomUUID: (() => string) | undefined;
  getRandomValues: (values: Uint8Array) => Uint8Array;
};

/** UUIDs identify local records, not authentication credentials. Supports HTTP LAN previews. */
export function createLocalId(entropy: Entropy = globalThis.crypto): string {
  if (typeof entropy.randomUUID === "function") return entropy.randomUUID();
  const bytes = entropy.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
