import { describe, expect, it } from "vitest";
import { findLogosByGame, findLogosCoveringDate } from "../src/collectors.js";
import { mapApiCategories, parseCompanyWikitext } from "../src/parse/company.js";
import { fixtureWikitext } from "./helpers.js";

const RETRIEVED = "2026-09-29T00:00:00.000Z";

function companyFrom(fixture: string, title?: string) {
  const page = fixtureWikitext(fixture);
  return parseCompanyWikitext(page.wikitext, {
    title: title ?? page.title,
    pageId: page.pageId,
    categories: mapApiCategories(page.categories),
    retrievedAt: RETRIEVED,
    contentTitle: page.title,
  });
}

describe("Sega", () => {
  const sega = companyFrom("sega.parse.json");

  it("reads the company and all 15 logo eras", () => {
    expect(sega.companyName).toBe("Sega Corporation");
    expect(sega.infobox?.founded).toBe("June 3, 1960");
    expect(sega.infobox?.country).toContain("Tokyo");
    expect(sega.description).toMatch(/Service Games/);
    expect(sega.logos).toHaveLength(15);
    expect(sega.categories.map((category) => category.title)).toContain("Video game logos");
    expect(sega.attribution.license.shortName).toBe("CC BY-SA 4.0");
    expect(sega.attribution.sourceUrl).toBe("https://www.avid.wiki/Sega");
    expect(sega.warnings.some((warning) => warning.includes("Variations"))).toBe(true);
    expect(sega.logos.every((logo) => logo.dateRanges.every((range) => range.kind !== "unknown"))).toBe(true);
  });

  it("parses ordinals, variants, and date ranges", () => {
    const summary = sega.logos.map((logo) => ({
      ordinal: logo.ordinal,
      label: logo.label,
      custom: logo.isCustomVariant,
      games: logo.gameTitles,
      dates: logo.dateRanges.map((range) => ({
        kind: range.kind,
        start: range.start?.iso ?? null,
        end: range.end?.iso ?? null,
        openEnd: range.openEnd,
        uncertain: Boolean(range.end?.uncertain),
      })),
    }));
    expect(summary).toEqual([
      {
        ordinal: 1,
        label: "Still variants",
        custom: false,
        games: [],
        dates: [{ kind: "open-ended", start: "1981-12", end: null, openEnd: true, uncertain: false }],
      },
      {
        ordinal: 2,
        label: null,
        custom: false,
        games: [],
        dates: [{ kind: "range", start: "1983", end: "1987", openEnd: false, uncertain: false }],
      },
      {
        ordinal: 3,
        label: null,
        custom: false,
        games: [],
        dates: [{ kind: "range", start: "1987", end: "1989", openEnd: false, uncertain: false }],
      },
      {
        ordinal: 4,
        label: null,
        custom: false,
        games: [],
        dates: [
          { kind: "range", start: "1988-10-29", end: "2002", openEnd: false, uncertain: false },
          { kind: "range", start: "2017-06-22", end: "2019-04-04", openEnd: false, uncertain: false },
        ],
      },
      {
        ordinal: 5,
        label: null,
        custom: false,
        games: [],
        dates: [{ kind: "range", start: "1989-03", end: "1989-09", openEnd: false, uncertain: false }],
      },
      {
        ordinal: 6,
        label: "Sonic CD prototypes custom variant",
        custom: true,
        games: ["Sonic CD"],
        dates: [{ kind: "range", start: "1992-12-04", end: "1993", openEnd: false, uncertain: true }],
      },
      {
        ordinal: 7,
        label: "Ecco series custom variant",
        custom: true,
        games: ["Ecco"],
        dates: [{ kind: "range", start: "1994-08-25", end: "1996-12-13", openEnd: false, uncertain: false }],
      },
      {
        ordinal: 8,
        label: "Knuckles' Chaotix custom variant",
        custom: true,
        games: ["Knuckles' Chaotix"],
        dates: [{ kind: "range", start: "1994-12-27", end: "1995-06", openEnd: false, uncertain: false }],
      },
      {
        ordinal: 9,
        label: "Sonic 3D Blast custom variant",
        custom: true,
        games: ["Sonic 3D Blast"],
        dates: [{ kind: "range", start: "1996-11-08", end: "1996-11-14", openEnd: false, uncertain: false }],
      },
      {
        ordinal: 10,
        label: "Sakura Wars / Sakura Taisen custom variant",
        custom: true,
        games: ["Sakura Wars", "Sakura Taisen"],
        dates: [{ kind: "range", start: "2000-02-24", end: "2000-09-21", openEnd: false, uncertain: false }],
      },
      {
        ordinal: 11,
        label: "Yakuza / Ryū ga Gotoku custom variant",
        custom: true,
        games: ["Yakuza", "Ryū ga Gotoku"],
        dates: [{ kind: "range", start: "2005-12-08", end: "2006-09-15", openEnd: false, uncertain: false }],
      },
      {
        ordinal: 12,
        label: null,
        custom: false,
        games: [],
        dates: [{ kind: "range", start: "2006-11-07", end: "2017-10-12", openEnd: false, uncertain: false }],
      },
      {
        ordinal: 13,
        label: "Yakuza 2 / Ryū ga Gotoku 2 custom variant",
        custom: true,
        games: ["Yakuza 2", "Ryū ga Gotoku 2"],
        dates: [{ kind: "range", start: "2006-12-07", end: "2008-09-19", openEnd: false, uncertain: false }],
      },
      {
        ordinal: 14,
        label: "Amazing Sega",
        custom: false,
        games: [],
        dates: [{ kind: "open-ended", start: "2017-05-18", end: null, openEnd: true, uncertain: false }],
      },
      {
        ordinal: 15,
        label: "Empower the Gamers",
        custom: false,
        games: [],
        dates: [{ kind: "instant", start: "2024-06-04", end: "2024-06-04", openEnd: false, uncertain: false }],
      },
    ]);
  });

  it("keeps subsection text and the images attached to an era", () => {
    const second = sega.logos[1];
    expect(second?.text.description).toMatch(/shimmers/);
    expect(second?.text.availability).toMatch(/Choplifter/);
    expect(second?.primaryImage?.title).toMatch(/Choplifter/);
    expect(second?.images.length).toBeGreaterThan(0);

    const fourth = sega.logos[3];
    expect(fourth?.text.availability).toMatch(/Altered Beast/);
    expect(fourth?.text.audio).toMatch(/SEGA choir/);
    expect(fourth?.images.length).toBeGreaterThan(3);
    expect(fourth?.videos.length).toBeGreaterThan(0);

    const sixth = sega.logos[5];
    expect(sixth?.text.availability).toMatch(/prototype/i);
    expect(sixth?.subsections.some((section) => section.key === "availability")).toBe(true);

    const yakuza = sega.logos[10];
    expect(yakuza?.videos.map((video) => video.id)).toContain("o39ZwegVNVw");
    expect(yakuza?.images).toEqual([]);

    expect(sega.logos[0]?.images.length).toBeGreaterThan(20);
    expect(sega.companyLogo?.title).toBe("File:SEGA logo.svg");
  });

  it("finds eras by game title and by date", () => {
    expect(findLogosByGame(sega, "Ecco").map((match) => [match.logo.ordinal, match.match])).toEqual([[7, "title"]]);
    expect(findLogosByGame(sega, "Sonic CD")[0]?.logo.ordinal).toBe(6);
    expect(findLogosByGame(sega, "Sakura Taisen")[0]?.logo.gameTitles).toContain("Sakura Taisen");
    expect(findLogosByGame(sega, "Ryu ga Gotoku").some((match) => match.match === "title")).toBe(true);
    expect(findLogosByGame(sega, "Altered Beast").some((match) => match.logo.ordinal === 4 && match.match === "text")).toBe(
      true,
    );
    expect(findLogosByGame(sega, "Altered Beast", { searchText: false })).toEqual([]);

    const ordinals = (date: string) => findLogosCoveringDate(sega, date).map((logo) => logo.ordinal);
    expect(ordinals("1981-11-15")).toEqual([]);
    expect(ordinals("1981-12-15")).toEqual([1]);
    expect(ordinals("1989-02-01")).toEqual([1, 3, 4]);
    expect(ordinals("1989-06-15")).toEqual([1, 3, 4, 5]);
    expect(ordinals("1995-06-01")).toEqual([1, 4, 7, 8]);
    expect(ordinals("1995-07-01")).toEqual([1, 4, 7]);
    expect(ordinals("1996-11-08")).toEqual(expect.arrayContaining([1, 4, 9]));
    expect(ordinals("1996-11-07")).not.toContain(9);
    expect(ordinals("2017-10-12")).toEqual(expect.arrayContaining([1, 4, 12, 14]));
    expect(ordinals("2017-10-13")).not.toContain(12);
    expect(ordinals("2018-01-01")).toEqual([1, 4, 14]);
    expect(ordinals("2024-06-04")).toEqual([1, 14, 15]);
    expect(ordinals("2024-06-05")).toEqual([1, 14]);
  });
});

describe("other companies", () => {
  it("parses Namco custom variants, including nested titles", () => {
    const namco = companyFrom("namco.parse.json");
    expect(namco.companyName).toBe("Namco");
    expect(namco.logos.length).toBeGreaterThanOrEqual(10);
    expect(namco.logos.every((logo) => logo.dateRanges.every((range) => range.kind !== "unknown"))).toBe(true);
    const starWars = namco.logos.find((logo) => logo.gameTitles.some((title) => title.startsWith("Star Wars")));
    expect(starWars?.isCustomVariant).toBe(true);
    expect(starWars?.dateRanges[0]?.start?.iso).toBe("1987-12-04");
    const gameBoy = namco.logos.find((logo) => logo.gameTitle === "Game Boy");
    expect(gameBoy?.dateRanges[0]?.start?.iso).toBe("1990-09-14");
    expect(gameBoy?.dateRanges[0]?.end?.iso).toBe("1990-11-16");
    const pac = namco.logos.find((logo) => logo.gameTitles.some((title) => title.includes("Pac-Man")));
    expect(pac?.gameTitles).toEqual(expect.arrayContaining(["Pac-Man 2: The New Adventures", "Hello! Pac-Man"]));
  });

  it("parses Nintendo production logos, including a semicolon range", () => {
    const page = fixtureWikitext("nintendo.parse.json");
    const parent = parseCompanyWikitext(page.wikitext, {
      title: page.title,
      categories: mapApiCategories(page.categories),
      retrievedAt: RETRIEVED,
    });
    expect(parent.logos).toHaveLength(0);
    expect(parent.linkedSubpages).toContain("/Production Logos");
    expect(parent.companyName).toBe("Nintendo Co., Ltd.");

    const logos = companyFrom("nintendo-production-logos.parse.json", "Nintendo/Production Logos");
    expect(logos.companyName).toBe("Nintendo");
    expect(logos.logos).toHaveLength(7);
    expect(logos.logos.every((logo) => logo.dateRanges.every((range) => range.kind !== "unknown"))).toBe(true);
    const fourth = logos.logos.find((logo) => logo.ordinal === 4);
    expect(fourth?.dateRanges.map((range) => range.start?.iso)).toEqual(["1993-07-14", "2010-12-12"]);
    expect(logos.logos.find((logo) => logo.ordinal === 3)?.gameTitle).toBe("King of the Zoo");
    expect(logos.logos.find((logo) => logo.ordinal === 6)?.gameTitle).toBe("Perfect Dark");
  });

  it("parses Konami production logos", () => {
    const konami = companyFrom("konami-production-logos.parse.json", "Konami/Production Logos");
    expect(konami.companyName).toBe("Konami");
    expect(konami.logos).toHaveLength(12);
    expect(konami.logos.every((logo) => logo.dateRanges.every((range) => range.kind !== "unknown"))).toBe(true);
    const sunset = konami.logos.find((logo) => logo.gameTitle === "Sunset Riders");
    expect(sunset?.dateRanges[0]?.kind).toBe("instant");
    expect(sunset?.dateRanges[0]?.start?.iso).toBe("1991-09");
    expect(konami.logos[0]?.dateRanges[0]?.end?.iso).toBe("1986-07-25");
  });
});
