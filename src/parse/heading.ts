import type { DateRange } from "../types.js";
import { expandDateTemplates, parseDateRanges } from "./dates.js";
import { stripHtml } from "./wikitext.js";

export interface ParsedHeading {
  ordinal: number;
  ordinalLabel: string;
  heading: string;
  label: string | null;
  isCustomVariant: boolean;
  gameTitle: string | null;
  gameTitles: string[];
  qualifiers: string[];
  dateText: string | null;
  dateRanges: DateRange[];
}

const LOGO_RE = /^(\d+)(st|nd|rd|th)\s+logo\b([\s\S]*)$/i;
const MONTH_OR_YEAR =
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|\d{4})\b/i;

/** Parse a logo-era heading. Returns null when the line is not an `Nth Logo` heading. */
export function parseLogoHeading(rawHeading: string): ParsedHeading | null {
  const heading = cleanHeading(rawHeading);
  const match = LOGO_RE.exec(heading);
  if (!match) return null;
  const ordinal = Number(match[1]);
  const ordinalLabel = `${match[1]}${(match[2] ?? "").toLowerCase()}`;
  const groups = parenGroups(match[3] ?? "");
  let dateText: string | null = null;
  const labels: string[] = [];
  if (groups.length > 0) {
    const last = groups[groups.length - 1] ?? "";
    if (looksLikeDate(last)) {
      dateText = last.trim();
      labels.push(...groups.slice(0, -1));
    } else {
      labels.push(...groups);
    }
  }
  const label = labels.map((part) => part.trim()).filter(Boolean).join(" ") || null;
  const variant = parseVariantLabel(label);
  const ranges = dateText ? parseDateRanges(dateText) : [];
  return {
    ordinal,
    ordinalLabel,
    heading,
    label,
    isCustomVariant: variant.isCustomVariant,
    gameTitle: variant.gameTitle,
    gameTitles: variant.gameTitles,
    qualifiers: variant.qualifiers,
    dateText,
    dateRanges: ranges,
  };
}

export function cleanHeading(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^={2,6}\s*/, "").replace(/\s*={2,6}$/, "");
  text = expandDateTemplates(text);
  text = stripHtml(text);
  text = text.replace(/'''/g, "").replace(/''/g, "");
  text = text.replace(/\u00a0/g, " ");
  text = text.replace(/[ \t]+/g, " ").trim();
  return text;
}

function looksLikeDate(value: string): boolean {
  return MONTH_OR_YEAR.test(value) || /\d\s*-\s*$/.test(value);
}

export function parenGroups(input: string): string[] {
  const groups: string[] = [];
  for (let i = 0; i < input.length; i += 1) {
    if (input[i] !== "(") continue;
    let depth = 1;
    let j = i + 1;
    while (j < input.length && depth > 0) {
      if (input[j] === "(") depth += 1;
      else if (input[j] === ")") depth -= 1;
      if (depth > 0) j += 1;
    }
    groups.push(input.slice(i + 1, j).trim());
    i = j;
  }
  return groups;
}

export function parseVariantLabel(label: string | null): {
  isCustomVariant: boolean;
  gameTitle: string | null;
  gameTitles: string[];
  qualifiers: string[];
} {
  if (!label || !/custom variant/i.test(label)) {
    return { isCustomVariant: false, gameTitle: null, gameTitles: [], qualifiers: [] };
  }
  let text = label.replace(/\s*custom variant\s*$/i, "").trim();
  text = text.replace(/'''/g, "").replace(/''/g, "").replace(/\s+/g, " ").trim();
  const qualifiers: string[] = [];
  const titles: string[] = [];
  for (const part of text.split(/\s+\/\s+/)) {
    let piece = part.trim();
    const alternate = /^(.*?)\s*\((.+?)\s+in\s+([^)]+)\)\s*$/i.exec(piece);
    if (alternate) {
      piece = (alternate[1] ?? "").trim();
      const altTitle = stripQualifier(alternate[2] ?? "", qualifiers);
      if (altTitle) titles.push(altTitle);
    }
    const cleaned = stripQualifier(piece, qualifiers);
    if (cleaned) titles.push(cleaned);
  }
  const unique = dedupe(titles);
  return {
    isCustomVariant: true,
    gameTitle: unique[0] ?? null,
    gameTitles: unique,
    qualifiers,
  };
}

function stripQualifier(value: string, qualifiers: string[]): string {
  const match = /^(.*?)(?:\s+(prototypes?|series))\s*$/i.exec(value.trim());
  if (match && (match[1] ?? "").trim()) {
    qualifiers.push((match[2] ?? "").toLowerCase());
    return (match[1] ?? "").trim();
  }
  return value.trim();
}

function dedupe(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function anchorFromHeading(heading: string): string {
  return heading.replace(/ /g, "_");
}
