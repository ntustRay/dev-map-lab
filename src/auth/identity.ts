import { z } from "zod";

export const memberSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  displayName: z.string().max(80),
});
export type Member = z.infer<typeof memberSchema>;

export function memberFromUser(user: {
  id: string;
  email?: string;
  user_metadata: Record<string, unknown>;
}): Member {
  const name =
    typeof user.user_metadata.display_name === "string"
      ? user.user_metadata.display_name.slice(0, 80)
      : "";
  return memberSchema.parse({
    id: user.id,
    email: user.email ?? null,
    displayName: name,
  });
}

export function accountScope(projectNamespace: string, userId: string): string {
  const id = z.string().uuid().parse(userId);
  if (!/^[a-zA-Z0-9.-]+$/.test(projectNamespace))
    throw new Error("會員資料空間設定錯誤。");
  return `member-${projectNamespace}-${id}`;
}
