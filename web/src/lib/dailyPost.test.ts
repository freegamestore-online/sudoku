import { describe, it, expect } from "vitest";
import { hasPostedDaily, markPostedDaily } from "./dailyPost";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("daily post tracking", () => {
  it("is not posted until marked, and only for that day", () => {
    const store = memoryStore();
    expect(hasPostedDaily("killer", "2026-10-16", store)).toBe(false);
    markPostedDaily("killer", "2026-10-16", store);
    expect(hasPostedDaily("killer", "2026-10-16", store)).toBe(true);
    expect(hasPostedDaily("killer", "2026-10-17", store)).toBe(false);
  });

  it("keeps each game's record apart", () => {
    const store = memoryStore();
    markPostedDaily("killer", "2026-10-16", store);
    expect(hasPostedDaily("queens", "2026-10-16", store)).toBe(false);
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
    expect(hasPostedDaily("killer", "2026-10-16", blocked)).toBe(false);
    expect(() => markPostedDaily("killer", "2026-10-16", blocked)).not.toThrow();
  });
});
