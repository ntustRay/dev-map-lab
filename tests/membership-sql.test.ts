import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let db: PGlite;
const ownerA = "11111111-1111-4111-8111-111111111111";
const ownerB = "22222222-2222-4222-8222-222222222222";
const payload = {
  schemaVersion: 1,
  exportedAt: 100,
  notes: [],
  attempts: [],
  progress: [],
  drafts: [],
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anonymous nologin;
    create role authenticated nologin;
    create schema auth;
    create schema neon_auth;
    create table neon_auth."user" (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema public to anonymous, authenticated;
    grant execute on function auth.uid(), auth.jwt() to anonymous, authenticated;
  `);
  await db.query('insert into neon_auth."user" (id) values ($1), ($2)', [
    ownerA,
    ownerB,
  ]);
  const directory = path.join(process.cwd(), "database/migrations");
  for (const file of (await readdir(directory))
    .filter((file) => file.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(path.join(directory, file), "utf8"));
}, 30000);
afterAll(async () => {
  await db?.close();
});

async function asUser<T>(
  owner: string,
  work: (tx: Parameters<Parameters<PGlite["transaction"]>[0]>[0]) => Promise<T>,
  verified = true,
) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [
      owner,
    ]);
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({
        sub: owner,
        emailVerified: verified,
        user_metadata: { emailVerified: true },
      }),
    ]);
    return work(tx);
  });
}

describe("Postgres 真實資料操作：RLS 與備份版本", () => {
  it("部署 migration 後，兩張表確實啟用 RLS，RPC 使用 invoker", async () => {
    const tables = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where relname in ('devmap_profiles','devmap_workspaces')",
    );
    expect(tables.rows).toHaveLength(2);
    expect(tables.rows.every((row) => row.relrowsecurity)).toBe(true);
    const functions = await db.query<{ prosecdef: boolean }>(
      "select prosecdef from pg_proc where proname in ('devmap_save_workspace','devmap_current_user_id')",
    );
    expect(functions.rows).toHaveLength(2);
    expect(functions.rows.every((row) => !row.prosecdef)).toBe(true);
  });
  it("A、B 只能讀自己的 profile", async () => {
    await asUser(ownerA, (tx) =>
      tx.query(
        "insert into public.devmap_profiles (user_id, display_name) values ($1, $2)",
        [ownerA, "Alice"],
      ),
    );
    await asUser(ownerB, (tx) =>
      tx.query(
        "insert into public.devmap_profiles (user_id, display_name) values ($1, $2)",
        [ownerB, "Bob"],
      ),
    );
    const a = await asUser(ownerA, (tx) =>
      tx.query<{ display_name: string }>(
        "select display_name from public.devmap_profiles",
      ),
    );
    const b = await asUser(ownerB, (tx) =>
      tx.query<{ display_name: string }>(
        "select display_name from public.devmap_profiles",
      ),
    );
    expect(a.rows).toEqual([{ display_name: "Alice" }]);
    expect(b.rows).toEqual([{ display_name: "Bob" }]);
  });
  it("未驗證信箱即使有有效身分，也不能讀寫自己的資料或以 metadata 冒充驗證", async () => {
    const read = await asUser(
      ownerA,
      (tx) => tx.query("select * from public.devmap_profiles"),
      false,
    );
    expect(read.rows).toHaveLength(0);
    await expect(
      asUser(
        ownerA,
        (tx) =>
          tx.query("select * from public.devmap_save_workspace($1,0,$2)", [
            ownerA,
            payload,
          ]),
        false,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    const profile = await asUser(
      ownerA,
      (tx) =>
        tx.query(
          "update public.devmap_profiles set display_name = 'forbidden' returning *",
        ),
      false,
    );
    expect(profile.rows).toHaveLength(0);
  });
  it("會員無法讀取私有 migration ledger", async () => {
    await expect(
      asUser(ownerA, (tx) =>
        tx.query("select * from devmap_internal.schema_migrations"),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("不能把自己的 profile 改成其他人的 user_id", async () => {
    await expect(
      asUser(ownerA, (tx) =>
        tx.query(
          "update public.devmap_profiles set user_id = $1 where user_id = $2",
          [ownerB, ownerA],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("未登入無法讀 profile 或呼叫保存 RPC", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.exec("set local role anonymous");
        return tx.query("select * from public.devmap_profiles");
      }),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.transaction(async (tx) => {
        await tx.exec("set local role anonymous");
        return tx.query("select * from public.devmap_save_workspace($1,0,$2)", [
          ownerA,
          payload,
        ]);
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("第一次保存建立版本 1，其他人看不到內容", async () => {
    const saved = await asUser(ownerA, (tx) =>
      tx.query<{ new_revision: number }>(
        "select * from public.devmap_save_workspace($1,0,$2)",
        [ownerA, payload],
      ),
    );
    expect(saved.rows[0]?.new_revision).toBe(1);
    const b = await asUser(ownerB, (tx) =>
      tx.query("select * from public.devmap_workspaces"),
    );
    expect(b.rows).toHaveLength(0);
  });
  it("目前版本可更新；舊版本或重複初次保存會拒絕且不改資料", async () => {
    const update = await asUser(ownerA, (tx) =>
      tx.query<{ new_revision: number }>(
        "select * from public.devmap_save_workspace($1,1,$2)",
        [ownerA, { ...payload, exportedAt: 200 }],
      ),
    );
    expect(update.rows[0]?.new_revision).toBe(2);
    await expect(
      asUser(ownerA, (tx) =>
        tx.query("select * from public.devmap_save_workspace($1,1,$2)", [
          ownerA,
          payload,
        ]),
      ),
    ).rejects.toMatchObject({ code: "40001" });
    await expect(
      asUser(ownerA, (tx) =>
        tx.query("select * from public.devmap_save_workspace($1,0,$2)", [
          ownerA,
          payload,
        ]),
      ),
    ).rejects.toMatchObject({ code: "40001" });
    const current = await asUser(ownerA, (tx) =>
      tx.query<{ revision: number; payload: { exportedAt: number } }>(
        "select revision,payload from public.devmap_workspaces",
      ),
    );
    expect(current.rows[0]?.revision).toBe(2);
    expect(current.rows[0]?.payload.exportedAt).toBe(200);
  });
  it("帳號在送出前切換時，預期 owner 不符會拒絕，不能把 A 的備份放進 B", async () => {
    await expect(
      asUser(ownerB, (tx) =>
        tx.query("select * from public.devmap_save_workspace($1,0,$2)", [
          ownerA,
          payload,
        ]),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    const b = await asUser(ownerB, (tx) =>
      tx.query("select * from public.devmap_workspaces"),
    );
    expect(b.rows).toHaveLength(0);
  });
  it("毀損格式與過大 payload 不會寫入資料庫", async () => {
    await expect(
      asUser(ownerB, (tx) =>
        tx.query("select * from public.devmap_save_workspace($1,0,$2)", [
          ownerB,
          { ...payload, schemaVersion: "1" },
        ]),
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      asUser(ownerB, (tx) =>
        tx.query("select * from public.devmap_save_workspace($1,0,$2)", [
          ownerB,
          { ...payload, schemaVersion: null },
        ]),
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      asUser(ownerB, (tx) =>
        tx.query("select * from public.devmap_save_workspace($1,0,$2)", [
          ownerB,
          { ...payload, notes: ["x".repeat(5242880)] },
        ]),
      ),
    ).rejects.toMatchObject({ code: "23514" });
    const b = await asUser(ownerB, (tx) =>
      tx.query("select * from public.devmap_workspaces"),
    );
    expect(b.rows).toHaveLength(0);
  });
});
