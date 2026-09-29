import { rangeBounds } from "./parse/dates.js";
import type { CompanyLogos, LogoEra, LogoGameMatch } from "./types.js";

export interface DateWindow {
  start: number;
  end: number;
}

/**
 * Logos whose heading date range overlaps `date`.
 * Open-ended eras (a trailing hyphen) match every later date, so a long-running
 * "still variants" logo is returned together with the era that was current then.
 */
export function findLogosCoveringDate(source: CompanyLogos | LogoEra[], date: string | Date): LogoEra[] {
  const logos = Array.isArray(source) ? source : source.logos;
  const query = dateWindow(date);
  return logos.filter((logo) =>
    logo.dateRanges.some((range) => {
      const bounds = rangeBounds(range);
      if (!bounds) return false;
      return query.start <= bounds.end && query.end >= bounds.start;
    }),
  );
}

/**
 * Logos tied to a game. Title matches come from custom-variant headings.
 * Text matches search the description, variants, and availability sections.
 */
export function findLogosByGame(
  source: CompanyLogos | LogoEra[],
  query: string,
  options: { searchText?: boolean } = {},
): LogoGameMatch[] {
  const logos = Array.isArray(source) ? source : source.logos;
  const needle = normalizeTitle(query);
  if (!needle) return [];
  const titleMatches: LogoGameMatch[] = [];
  const textMatches: LogoGameMatch[] = [];
  for (const logo of logos) {
    const titleHit = logo.gameTitles.some((title) => titlesMatch(needle, normalizeTitle(title)));
    if (titleHit) {
      titleMatches.push({ logo, match: "title" });
      continue;
    }
    if (options.searchText === false) continue;
    const haystack = normalizeTitle(
      [logo.label, logo.text.description, logo.text.variants, logo.text.availability].filter(Boolean).join("\n"),
    );
    if (haystack.includes(needle)) textMatches.push({ logo, match: "text" });
  }
  return [...titleMatches, ...textMatches];
}

export function dateWindow(date: string | Date): DateWindow {
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
    return dayWindow(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const value = date.trim();
  const year = /^(\d{4})$/.exec(value);
  if (year) return yearWindow(Number(year[1]));
  const month = /^(\d{4})-(\d{2})$/.exec(value);
  if (month) return monthWindow(Number(month[1]), Number(month[2]));
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (day) return dayWindow(Number(day[1]), Number(day[2]), Number(day[3]));
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError(`Could not read a date from "${date}". Use YYYY, YYYY-MM, or YYYY-MM-DD.`);
  }
  return dayWindow(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
}

function titlesMatch(needle: string, title: string): boolean {
  if (!title) return false;
  if (title.includes(needle)) return true;
  return title.length >= 4 && needle.includes(title);
}

export function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function yearWindow(year: number): DateWindow {
  return { start: Date.UTC(year, 0, 1), end: Date.UTC(year, 11, 31, 23, 59, 59, 999) };
}

function monthWindow(year: number, month: number): DateWindow {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: Date.UTC(year, month - 1, 1),
    end: Date.UTC(year, month - 1, last, 23, 59, 59, 999),
  };
}

function dayWindow(year: number, month: number, day: number): DateWindow {
  return {
    start: Date.UTC(year, month - 1, day),
    end: Date.UTC(year, month - 1, day, 23, 59, 59, 999),
  };
}
