import { describe, it, expect } from "vitest";
import { hasPostedKillerDaily, markPostedKillerDaily } from "./dailyPost";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("Killer daily post tracking", () => {
  it("is not posted until marked, and only for that day", () => {
    const store = memoryStore();
    expect(hasPostedKillerDaily("2026-10-16", store)).toBe(false);
    markPostedKillerDaily("2026-10-16", store);
    expect(hasPostedKillerDaily("2026-10-16", store)).toBe(true);
    expect(hasPostedKillerDaily("2026-10-17", store)).toBe(false);
  });

  it("treats blocked storage as not posted, without throwing", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(hasPostedKillerDaily("2026-10-16", blocked)).toBe(false);
    expect(() => markPostedKillerDaily("2026-10-16", blocked)).not.toThrow();
  });
});
