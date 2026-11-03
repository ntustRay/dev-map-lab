import { describe, expect, it } from "vitest";
import { createLocalId } from "../src/core/local-id";

describe("本機 ID 在 HTTP 與 HTTPS 環境的相容性", () => {
  it("有 randomUUID 時使用標準 API", () => {
    expect(
      createLocalId({
        randomUUID: () => "known-id",
        getRandomValues: (bytes) => bytes,
      }),
    ).toBe("known-id");
  });
  it("HTTP 環境缺少 randomUUID 時，用 getRandomValues 建立 v4 ID", () => {
    const id = createLocalId({
      randomUUID: undefined,
      getRandomValues: (bytes) => {
        bytes.fill(0xff);
        return bytes;
      },
    });
    expect(id).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  });
  it("一般環境可產生不同 ID", () => {
    expect(createLocalId()).not.toBe(createLocalId());
  });
});
