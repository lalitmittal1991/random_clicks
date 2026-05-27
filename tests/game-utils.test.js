import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  getPoolForMode,
  normalizeKey,
  calculateAccuracy,
  mostMissedSymbol,
} = require("../game-utils");

describe("getPoolForMode", () => {
  it("returns alphabet for letters mode", () => {
    const pool = getPoolForMode("letters");
    expect(pool[0]).toBe("A");
    expect(pool[25]).toBe("Z");
    expect(pool.length).toBe(26);
  });

  it("returns 1-10 for numbers mode", () => {
    const pool = getPoolForMode("numbers");
    expect(pool).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  });

  it("returns mixed for mixed mode", () => {
    const pool = getPoolForMode("mixed");
    expect(pool.length).toBe(36);
    expect(pool.includes("A")).toBe(true);
    expect(pool.includes("10")).toBe(true);
  });
});

describe("normalizeKey", () => {
  it("uppercases alphabet keys", () => {
    expect(normalizeKey("a")).toBe("A");
    expect(normalizeKey("Z")).toBe("Z");
  });

  it("keeps single digits", () => {
    expect(normalizeKey("1")).toBe("1");
    expect(normalizeKey("9")).toBe("9");
  });

  it("returns empty for unsupported keys", () => {
    expect(normalizeKey("Enter")).toBe("");
    expect(normalizeKey("@")).toBe("");
  });
});

describe("calculateAccuracy", () => {
  it("returns 0 for 0 attempts", () => {
    expect(calculateAccuracy(0, 0)).toBe(0);
  });

  it("computes percentage", () => {
    expect(calculateAccuracy(9, 10)).toBe(90);
  });
});

describe("mostMissedSymbol", () => {
  it("returns empty for no misses", () => {
    expect(mostMissedSymbol({})).toBe("");
  });

  it("returns most missed symbol", () => {
    expect(mostMissedSymbol({ A: 2, B: 5, C: 3 })).toBe("B");
  });
});
