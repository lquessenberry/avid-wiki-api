import type { DateEndpoint, DatePrecision, DateRange } from "../types.js";

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const MONTH_PATTERN = Object.keys(MONTHS).join("|");

type Tok =
  | { kind: "month"; month: number }
  | { kind: "num"; value: number; uncertain: boolean }
  | { kind: "year"; value: number; uncertain: boolean }
  | { kind: "dash" }
  | { kind: "open" };

interface PartialPoint {
  year?: number;
  month?: number;
  day?: number;
  uncertain?: boolean;
}

/**
 * Expand AVID's `{{date}}` template the way the wiki renders it, without the
 * per-year search superscripts that template adds for editors.
 */
export function expandDateTemplates(wikitext: string): string {
  return wikitext.replace(/\{\{\s*date\b([^{}]*)\}\}/gi, (_full, body: string) => {
    return renderDateTemplate(parseTemplateParams(body));
  });
}

export function parseTemplateParams(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  const payload = body.replace(/^\s*\|/, "");
  for (const part of payload.split("|")) {
    if (!part.trim()) continue;
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    params[key] = value;
  }
  return params;
}

/** Mirrors Template:Date on avid.wiki, minus the navigation superscripts. */
export function renderDateTemplate(params: Record<string, string>): string {
  const month = params.month ?? "";
  const day = params.day ?? "";
  const month2 = params.month2 ?? "";
  const day2 = params.day2 ?? "";
  const year = params.year ?? "";
  let out = "";
  if (month) {
    out += month;
    if (day) out += ` ${day}`;
    if (day2 || month2) out += "-";
    if (month2) {
      out += month2;
      if (day2) out += ` ${day2}`;
      if (day2) out += ",";
    } else if (day2) {
      out += day2;
      if (day) out += ",";
    } else if (day) {
      out += ",";
    }
    if (year) out += ` ${year}`;
  } else {
    out += year;
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Parse the date parenthetical of a logo heading into one or more ranges.
 * The input should already have `{{date}}` templates expanded.
 */
export function parseDateRanges(input: string): DateRange[] {
  const normalized = input
    .replace(/\u00a0/g, " ")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];
  return normalized
    .split(/\s*;\s*/)
    .flatMap((part) => splitOnRangeCommas(part))
    .filter(Boolean)
    .map((part) => parseOneRange(part));
}

function splitOnRangeCommas(input: string): string[] {
  // A comma starts another range only when the next range opens with a month
  // ("2002, June 22, 2017"). Commas inside "April 4, 2019" stay put.
  const boundary = new RegExp(String.raw`,\s*(?=(?:${MONTH_PATTERN})\b)`, "gi");
  const parts: string[] = [];
  let last = 0;
  for (const match of input.matchAll(boundary)) {
    const index = match.index ?? 0;
    const left = input.slice(last, index);
    if (/\b\d{4}\b/.test(left)) {
      parts.push(left.trim());
      last = index + match[0].length;
    }
  }
  parts.push(input.slice(last).trim());
  return parts.filter(Boolean);
}

function parseOneRange(raw: string): DateRange {
  const tokens = tokenize(raw);
  if (tokens.length === 0) return unknown(raw);

  let separator = -1;
  let seenYear = false;
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i]?.kind === "year") seenYear = true;
    if (tokens[i]?.kind === "dash" && seenYear) {
      separator = i;
      break;
    }
  }

  if (separator === -1) {
    const dash = tokens.findIndex((token) => token.kind === "dash");
    if (dash === -1) {
      const point = parsePoint(tokens.filter((token) => token.kind !== "open"));
      const endpoint = point ? toEndpoint(point) : null;
      if (!point || !endpoint) return unknown(raw);
      return {
        raw,
        start: endpoint,
        end: endpoint,
        openStart: false,
        openEnd: false,
        kind: "instant",
      };
    }
    const left = parsePoint(tokens.slice(0, dash));
    const right = parsePoint(tokens.slice(dash + 1).filter((token) => token.kind !== "open"));
    if (!left || !right) return unknown(raw);
    const start = toEndpoint(left, right);
    const end = toEndpoint(right, left);
    if (!start || !end) return unknown(raw);
    return { raw, start, end, openStart: false, openEnd: false, kind: "range" };
  }

  const left = parsePoint(tokens.slice(0, separator));
  const rightTokens = tokens
    .slice(separator + 1)
    .filter((token) => token.kind !== "dash" && token.kind !== "open");
  if (!left) return unknown(raw);
  const start = toEndpoint(left);
  if (!start) return unknown(raw);
  if (rightTokens.length === 0) {
    return { raw, start, end: null, openStart: false, openEnd: true, kind: "open-ended" };
  }
  const right = parsePoint(rightTokens);
  if (!right) return unknown(raw);
  const end = toEndpoint(right, left);
  if (!end) return unknown(raw);
  return { raw, start, end, openStart: false, openEnd: false, kind: "range" };
}

function tokenize(input: string): Tok[] {
  const tokens: Tok[] = [];
  const re = /([A-Za-z]+|\d{1,4}(?:st|nd|rd|th)?\??|-)/g;
  for (const match of input.matchAll(re)) {
    const raw = match[1] ?? "";
    if (raw === "-") {
      tokens.push({ kind: "dash" });
      continue;
    }
    const lower = raw.toLowerCase();
    if (lower === "present" || lower === "current" || lower === "now" || lower === "today") {
      tokens.push({ kind: "open" });
      continue;
    }
    const month = MONTHS[lower];
    if (month) {
      tokens.push({ kind: "month", month });
      continue;
    }
    const num = raw.match(/^(\d+)(?:st|nd|rd|th)?(\?)?$/i);
    if (!num) continue;
    const value = Number(num[1]);
    const uncertain = Boolean(num[2]);
    if ((num[1] ?? "").length === 4) tokens.push({ kind: "year", value, uncertain });
    else tokens.push({ kind: "num", value, uncertain });
  }
  return tokens;
}

function parsePoint(tokens: Tok[]): PartialPoint | null {
  let index = 0;
  const point: PartialPoint = {};
  const first = tokens[index];
  if (first?.kind === "month") {
    point.month = first.month;
    index += 1;
  }
  const second = tokens[index];
  if (second?.kind === "num") {
    point.day = second.value;
    point.uncertain = point.uncertain || second.uncertain;
    index += 1;
  }
  const third = tokens[index];
  if (third?.kind === "year") {
    point.year = third.value;
    point.uncertain = point.uncertain || third.uncertain;
    index += 1;
  }
  if (index !== tokens.length) return null;
  if (point.year === undefined && point.month === undefined && point.day === undefined) return null;
  return point;
}

function toEndpoint(point: PartialPoint, inherit?: PartialPoint): DateEndpoint | null {
  const year = point.year ?? inherit?.year;
  if (!year) return null;
  let month = point.month ?? null;
  let day = point.day ?? null;
  if (month === null && day !== null && inherit?.month) month = inherit.month;
  if (day !== null && month !== null && !isValidDay(year, month, day)) {
    day = null;
  }
  if (day !== null && month === null) day = null;
  const precision: DatePrecision = day !== null ? "day" : month !== null ? "month" : "year";
  return {
    year,
    month,
    day,
    precision,
    uncertain: Boolean(point.uncertain),
    iso: formatIso(year, month, day, precision),
  };
}

function isValidDay(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function formatIso(year: number, month: number | null, day: number | null, precision: DatePrecision): string {
  if (precision === "day" && month !== null && day !== null) {
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  if (precision === "month" && month !== null) return `${year}-${pad(month)}`;
  return String(year);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function unknown(raw: string): DateRange {
  return {
    raw,
    start: null,
    end: null,
    openStart: false,
    openEnd: false,
    kind: "unknown",
  };
}

/** Inclusive UTC bounds of an endpoint at its stated precision. */
export function endpointBounds(endpoint: DateEndpoint): { start: number; end: number } {
  const month = endpoint.month ?? 1;
  const day = endpoint.day ?? 1;
  const start = Date.UTC(endpoint.year, month - 1, day);
  if (endpoint.precision === "day" && endpoint.month && endpoint.day) {
    return { start, end: Date.UTC(endpoint.year, endpoint.month - 1, endpoint.day, 23, 59, 59, 999) };
  }
  if (endpoint.precision === "month" && endpoint.month) {
    const last = new Date(Date.UTC(endpoint.year, endpoint.month, 0)).getUTCDate();
    return { start: Date.UTC(endpoint.year, endpoint.month - 1, 1), end: Date.UTC(endpoint.year, endpoint.month - 1, last, 23, 59, 59, 999) };
  }
  return { start: Date.UTC(endpoint.year, 0, 1), end: Date.UTC(endpoint.year, 11, 31, 23, 59, 59, 999) };
}

export function rangeBounds(range: DateRange): { start: number; end: number } | null {
  if (!range.start && !range.end) return null;
  const start = range.openStart || !range.start ? Number.NEGATIVE_INFINITY : endpointBounds(range.start).start;
  const end = range.openEnd || !range.end ? Number.POSITIVE_INFINITY : endpointBounds(range.end).end;
  return { start, end };
}
