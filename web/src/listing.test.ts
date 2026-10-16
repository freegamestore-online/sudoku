import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WEB = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(WEB, rel), "utf-8");

/** The description a store listing and a search result show: the meta tag in the HTML shell. */
function metaDescription(html: string): string {
  const match = html.match(/<meta name="description" content="([^"]*)"/);
  return match?.[1] ?? "";
}

describe("listing copy", () => {
  const html = read("index.html");
  const description = metaDescription(html);

  it("describes Classic, Killer Sudoku and Queens", () => {
    expect(description).toMatch(/Classic|classic/);
    expect(description).toContain("Killer Sudoku");
    expect(description).toContain("Queens");
  });

  it("mentions the daily puzzles", () => {
    expect(description).toMatch(/daily/i);
  });

  it("fits a search snippet", () => {
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it("makes no tracking or ad claims, since the page loads the platform analytics script", () => {
    expect(html).toContain("analytics.js");
    expect(description).not.toMatch(/no tracking|no ads|ad-free|ad free/i);
  });

  it("gives the installed app the same modes in its manifest description", () => {
    const manifest = read("vite.config.ts");
    expect(manifest).toMatch(/description: 'Sudoku: [^']*Killer[^']*Queens/);
  });
});

describe("theme", () => {
  it("declares color-scheme so native controls follow light and dark", () => {
    expect(read("index.html")).toContain('name="color-scheme" content="light dark"');
    expect(read("src/index.css")).toContain("color-scheme: light dark");
  });
});
