import { describe, expect, it } from "vitest";
import { AvidWikiClient } from "../src/index.js";

const live = process.env.AVID_LIVE === "1";

describe.skipIf(!live)("live AVID API", () => {
  it(
    "parses the current Sega article into its logo eras",
    async () => {
      const client = new AvidWikiClient({ minIntervalMs: 300, maxConcurrency: 1 });
      const company = await client.getCompany("Sega");
      expect(company.companyName).toMatch(/Sega/);
      expect(company.logos.length).toBeGreaterThanOrEqual(14);
      expect(company.logos.length).toBeLessThanOrEqual(20);
      expect(company.logos[0]?.ordinal).toBe(1);
      expect(company.logos[0]?.dateRanges[0]?.start?.year).toBe(1981);
      expect(company.logos.find((logo) => logo.ordinal === 4)?.dateRanges).toHaveLength(2);
      expect(company.logos.some((logo) => logo.isCustomVariant && logo.gameTitles.includes("Ecco"))).toBe(true);
      expect(company.attribution.license.shortName).toBe("CC BY-SA 4.0");
      expect(company.attribution.sourceUrl).toContain("avid.wiki");
      expect(company.logos.every((logo) => logo.dateRanges.every((range) => range.kind !== "unknown"))).toBe(true);
    },
    30_000,
  );
});
