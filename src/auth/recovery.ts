import { z } from "zod";

const key = "dev-map-lab-password-recovery";
const markerSchema = z.object({
  userId: z.string().uuid(),
  expiresAt: z.number(),
});
type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
let inMemory: z.infer<typeof markerSchema> | null = null;

// This is a short-lived UI flow marker, never an authentication or authorization credential.
export function rememberRecovery(
  userId: string,
  storage?: RecoveryStorage,
  now = Date.now(),
) {
  inMemory = { userId, expiresAt: now + 15 * 60 * 1000 };
  try {
    (storage ?? window.sessionStorage).setItem(key, JSON.stringify(inMemory));
  } catch {
    /* The in-memory Auth event still controls the current page. */
  }
}
export function hasRecovery(
  userId: string,
  storage?: RecoveryStorage,
  now = Date.now(),
): boolean {
  try {
    const value = (storage ?? window.sessionStorage).getItem(key);
    const marker = markerSchema.safeParse(value ? JSON.parse(value) : inMemory);
    return (
      marker.success &&
      marker.data.userId === userId &&
      marker.data.expiresAt > now
    );
  } catch {
    return inMemory?.userId === userId && inMemory.expiresAt > now;
  }
}
export function forgetRecovery(storage?: RecoveryStorage) {
  inMemory = null;
  try {
    (storage ?? window.sessionStorage).removeItem(key);
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
}
