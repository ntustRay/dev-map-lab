"use client";

import { z } from "zod";
import { jsonValueSchema } from "../core/content-schema";
import { type Backup, backupSchema } from "../storage/schema";
import { getVerifiedUser, requireMemberClient } from "./client";
import { displayNameSchema } from "./config";
import { MemberOperationError } from "./errors";

export const MAX_CLOUD_BACKUP_BYTES = 5 * 1024 * 1024;
const snapshotSchema = z.object({
  user_id: z.string().uuid(),
  revision: z.number().int().positive(),
  payload: backupSchema,
  updated_at: z.string().datetime({ offset: true }),
});
export type CloudSnapshot = z.infer<typeof snapshotSchema>;
const receiptSchema = z
  .array(
    z.object({
      new_revision: z.number().int().positive(),
      saved_at: z.string().datetime({ offset: true }),
    }),
  )
  .length(1);

async function verifyOwner(ownerId: string) {
  const client = requireMemberClient();
  const user = await getVerifiedUser();
  if (!user || user.id !== ownerId || !user.email_confirmed_at)
    throw new MemberOperationError("帳號已切換，請在目前帳號重新操作。");
  return client;
}

export async function readCloudSnapshot(
  ownerId: string,
): Promise<CloudSnapshot | null> {
  const client = await verifyOwner(ownerId);
  const { data, error } = await client
    .from("devmap_workspaces")
    .select("user_id,revision,payload,updated_at")
    .eq("user_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const snapshot = snapshotSchema.safeParse(data);
  if (!snapshot.success || snapshot.data.user_id !== ownerId)
    throw new MemberOperationError("雲端備份格式不相容；本機資料維持原狀。");
  return snapshot.data;
}

export function validateCloudBackup(raw: unknown): Backup {
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success)
    throw new MemberOperationError("備份格式不正確，請先檢查本機資料。");
  if (
    new TextEncoder().encode(JSON.stringify(parsed.data)).length >
    MAX_CLOUD_BACKUP_BYTES
  )
    throw new MemberOperationError(
      "雲端備份上限為 5 MB，請先使用檔案備份保存資料。",
    );
  return parsed.data;
}

export async function saveCloudSnapshot(
  ownerId: string,
  revision: number,
  raw: unknown,
): Promise<{ revision: number; savedAt: string }> {
  const backup = validateCloudBackup(raw);
  const client = await verifyOwner(ownerId);
  const { data, error } = await client.rpc("devmap_save_workspace", {
    expected_user_id: ownerId,
    expected_revision: z.number().int().min(0).parse(revision),
    new_payload: jsonValueSchema.parse(backup),
  });
  if (error) throw error;
  const row = receiptSchema.parse(data)[0];
  if (!row)
    throw new MemberOperationError("雲端未回傳保存結果，請重新讀取備份狀態。");
  return { revision: row.new_revision, savedAt: row.saved_at };
}

export async function readDisplayName(ownerId: string): Promise<string | null> {
  const client = await verifyOwner(ownerId);
  const { data, error } = await client
    .from("devmap_profiles")
    .select("display_name")
    .eq("user_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data ? displayNameSchema.parse(data.display_name) : null;
}

export async function saveDisplayName(
  ownerId: string,
  displayName: string,
): Promise<void> {
  const client = await verifyOwner(ownerId);
  const { error } = await client.from("devmap_profiles").upsert({
    user_id: ownerId,
    display_name: displayNameSchema.parse(displayName),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
