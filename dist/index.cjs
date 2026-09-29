"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ATTRIBUTION_REQUIREMENTS: () => ATTRIBUTION_REQUIREMENTS,
  AVID_API_URL: () => AVID_API_URL,
  AVID_SITE_NAME: () => AVID_SITE_NAME,
  AVID_SITE_URL: () => AVID_SITE_URL,
  AvidError: () => AvidError,
  AvidWikiClient: () => AvidWikiClient,
  CC_BY_SA_4_0: () => CC_BY_SA_4_0,
  DEFAULT_USER_AGENT: () => DEFAULT_USER_AGENT,
  MemoryCache: () => MemoryCache,
  VERSION: () => VERSION,
  attributionFor: () => attributionFor,
  createAvidClient: () => createAvidClient,
  expandDateTemplates: () => expandDateTemplates,
  filePageUrl: () => filePageUrl,
  fileTitle: () => fileTitle,
  findLogosByGame: () => findLogosByGame,
  findLogosCoveringDate: () => findLogosCoveringDate,
  mapApiCategories: () => mapApiCategories,
  pageUrl: () => pageUrl,
  parseCompanyWikitext: () => parseCompanyWikitext,
  parseDateRanges: () => parseDateRanges,
  parseLogoHeading: () => parseLogoHeading
});
module.exports = __toCommonJS(index_exports);

// src/version.ts
var VERSION = "0.1.0";

// src/errors.ts
var AvidError = class extends Error {
  code;
  status;
  constructor(message, options = {}) {
    super(message, options.cause !== void 0 ? { cause: options.cause } : void 0);
    this.name = "AvidError";
    this.code = options.code ?? "error";
    this.status = options.status ?? null;
  }
};

// src/cache.ts
var MemoryCache = class {
  constructor(defaultTtlMs = 5 * 60 * 1e3) {
    this.defaultTtlMs = defaultTtlMs;
  }
  defaultTtlMs;
  store = /* @__PURE__ */ new Map();
  get(key) {
    const hit = this.store.get(key);
    if (!hit) return void 0;
    if (hit.expires <= Date.now()) {
      this.store.delete(key);
      return void 0;
    }
    return hit.value;
  }
  set(key, value, ttlMs = this.defaultTtlMs) {
    this.store.set(key, { value, expires: Date.now() + ttlMs });
  }
  delete(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  get size() {
    return this.store.size;
  }
};

// src/attribution.ts
var AVID_API_URL = "https://www.avid.wiki/w/api.php";
var AVID_SITE_URL = "https://www.avid.wiki";
var AVID_SITE_NAME = "Audiovisual Identity Database";
var DEFAULT_USER_AGENT = `avid-wiki-api/${VERSION} (https://github.com/lquessenberry/avid-wiki-api)`;
var CC_BY_SA_4_0 = {
  name: "Creative Commons Attribution-ShareAlike 4.0 International",
  shortName: "CC BY-SA 4.0",
  url: "https://creativecommons.org/licenses/by-sa/4.0/"
};
var ATTRIBUTION_REQUIREMENTS = "Content from the Audiovisual Identity Database is licensed under CC BY-SA 4.0. Credit the wiki, link the source page and the license, and distribute adaptations under the same license. Image files can carry a different license; check each file before republishing it.";
function pageUrl(title, siteUrl = AVID_SITE_URL) {
  const base = siteUrl.replace(/\/$/, "");
  const slug = title.trim().replace(/ /g, "_");
  const encoded = encodeURIComponent(slug).replace(/%2F/g, "/").replace(/%3A/g, ":").replace(/%28/g, "(").replace(/%29/g, ")");
  return `${base}/${encoded}`;
}
function attributionFor(title, siteUrl = AVID_SITE_URL) {
  return {
    siteName: AVID_SITE_NAME,
    siteUrl: siteUrl.replace(/\/$/, "") + "/",
    title,
    sourceUrl: pageUrl(title, siteUrl),
    license: CC_BY_SA_4_0,
    requirements: ATTRIBUTION_REQUIREMENTS
  };
}
function fileTitle(name) {
  const trimmed = name.trim().replace(/^File:/i, "").replace(/^Image:/i, "").trim();
  const spaced = trimmed.replace(/_/g, " ").replace(/\s+/g, " ");
  return `File:${spaced}`;
}
function filePageUrl(name, siteUrl = AVID_SITE_URL) {
  return pageUrl(fileTitle(name), siteUrl);
}

// src/limit.ts
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
var RequestGate = class {
  constructor(concurrency, minIntervalMs) {
    this.concurrency = concurrency;
    this.minIntervalMs = minIntervalMs;
  }
  concurrency;
  minIntervalMs;
  active = 0;
  queue = [];
  nextAllowed = 0;
  async run(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
  acquire() {
    return new Promise((resolve) => {
      const start = () => {
        this.active += 1;
        const now = Date.now();
        const delay = Math.max(0, this.nextAllowed - now);
        this.nextAllowed = Math.max(this.nextAllowed, now) + this.minIntervalMs;
        if (delay === 0) resolve();
        else setTimeout(resolve, delay);
      };
      if (this.active < Math.max(1, this.concurrency)) start();
      else this.queue.push(start);
    });
  }
  release() {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }
};

// src/parse/dates.ts
var MONTHS = {
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
  december: 12
};
var MONTH_PATTERN = Object.keys(MONTHS).join("|");
function expandDateTemplates(wikitext) {
  return wikitext.replace(/\{\{\s*date\b([^{}]*)\}\}/gi, (_full, body) => {
    return renderDateTemplate(parseTemplateParams(body));
  });
}
function parseTemplateParams(body) {
  const params = {};
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
function renderDateTemplate(params) {
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
function parseDateRanges(input) {
  const normalized = input.replace(/\u00a0/g, " ").replace(/[–—−]/g, "-").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  return normalized.split(/\s*;\s*/).flatMap((part) => splitOnRangeCommas(part)).filter(Boolean).map((part) => parseOneRange(part));
}
function splitOnRangeCommas(input) {
  const boundary = new RegExp(String.raw`,\s*(?=(?:${MONTH_PATTERN})\b)`, "gi");
  const parts = [];
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
function parseOneRange(raw) {
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
        kind: "instant"
      };
    }
    const left2 = parsePoint(tokens.slice(0, dash));
    const right2 = parsePoint(tokens.slice(dash + 1).filter((token) => token.kind !== "open"));
    if (!left2 || !right2) return unknown(raw);
    const start2 = toEndpoint(left2, right2);
    const end2 = toEndpoint(right2, left2);
    if (!start2 || !end2) return unknown(raw);
    return { raw, start: start2, end: end2, openStart: false, openEnd: false, kind: "range" };
  }
  const left = parsePoint(tokens.slice(0, separator));
  const rightTokens = tokens.slice(separator + 1).filter((token) => token.kind !== "dash" && token.kind !== "open");
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
function tokenize(input) {
  const tokens = [];
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
function parsePoint(tokens) {
  let index = 0;
  const point = {};
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
  if (point.year === void 0 && point.month === void 0 && point.day === void 0) return null;
  return point;
}
function toEndpoint(point, inherit) {
  const year = point.year ?? inherit?.year;
  if (!year) return null;
  let month = point.month ?? null;
  let day = point.day ?? null;
  if (month === null && day !== null && inherit?.month) month = inherit.month;
  if (day !== null && month !== null && !isValidDay(year, month, day)) {
    day = null;
  }
  if (day !== null && month === null) day = null;
  const precision = day !== null ? "day" : month !== null ? "month" : "year";
  return {
    year,
    month,
    day,
    precision,
    uncertain: Boolean(point.uncertain),
    iso: formatIso(year, month, day, precision)
  };
}
function isValidDay(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function formatIso(year, month, day, precision) {
  if (precision === "day" && month !== null && day !== null) {
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  if (precision === "month" && month !== null) return `${year}-${pad(month)}`;
  return String(year);
}
function pad(value) {
  return String(value).padStart(2, "0");
}
function unknown(raw) {
  return {
    raw,
    start: null,
    end: null,
    openStart: false,
    openEnd: false,
    kind: "unknown"
  };
}
function endpointBounds(endpoint) {
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
function rangeBounds(range) {
  if (!range.start && !range.end) return null;
  const start = range.openStart || !range.start ? Number.NEGATIVE_INFINITY : endpointBounds(range.start).start;
  const end = range.openEnd || !range.end ? Number.POSITIVE_INFINITY : endpointBounds(range.end).end;
  return { start, end };
}

// src/parse/wikitext.ts
var KNOWN_KEYS = /* @__PURE__ */ new Set([
  "visuals",
  "variants",
  "technique",
  "audio",
  "availability",
  "trivia",
  "overview"
]);
function canonicalSectionKey(title) {
  const compact = title.toLowerCase().replace(/[^a-z]/g, "");
  const aliases = {
    visuals: "visuals",
    visual: "visuals",
    description: "visuals",
    logo: "visuals",
    variant: "variants",
    variants: "variants",
    prototypevariant: "variants",
    technique: "technique",
    audio: "audio",
    audiovariant: "audio",
    audiovariants: "audio",
    audiotrivia: "audio",
    availability: "availability",
    availabiiity: "availability",
    trivia: "trivia",
    overview: "overview"
  };
  return aliases[compact] ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function stripHtml(input) {
  return decodeEntities(input.replace(/<[^>]+>/g, ""));
}
function decodeEntities(input) {
  return input.replace(/&#(\d+);/g, (_m, dec) => safeChar(Number(dec))).replace(/&#x([0-9a-f]+);/gi, (_m, hex) => safeChar(Number.parseInt(hex, 16))).replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'");
}
function safeChar(code) {
  if (!Number.isFinite(code) || code < 0 || code > 1114111) return "";
  return String.fromCodePoint(code);
}
function fileKey(name) {
  return name.replace(/^File:/i, "").replace(/^Image:/i, "").replace(/_/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}
function toLogoImage(name, siteUrl) {
  const cleaned = name.trim();
  return {
    name: cleaned,
    title: fileTitle(cleaned),
    pageUrl: filePageUrl(cleaned, siteUrl)
  };
}
function extractImages(wikitext, siteUrl) {
  const names = [];
  const gallery = /<gallery\b[^>]*>([\s\S]*?)<\/gallery>/gi;
  for (const match of wikitext.matchAll(gallery)) {
    const body = match[1] ?? "";
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^(?:<|\{|\||!)/.test(trimmed)) continue;
      const name = trimmed.split("|")[0]?.trim() ?? "";
      if (name) names.push(stripFilePrefix(name));
    }
  }
  const fileLink = /\[\[(?:File|Image):([^\]|#]+)/gi;
  for (const match of wikitext.matchAll(fileLink)) {
    const name = (match[1] ?? "").trim();
    if (name) names.push(name);
  }
  const images = [];
  const seen = /* @__PURE__ */ new Set();
  for (const name of names) {
    const key = fileKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    images.push(toLogoImage(name, siteUrl));
  }
  return images;
}
function extractVideos(wikitext) {
  const ids = [];
  const templates = /\{\{\s*youtube\b([^{}]*)\}\}/gi;
  for (const match of wikitext.matchAll(templates)) {
    const body = match[1] ?? "";
    const named = [...body.matchAll(/\bid\d*\s*=\s*([A-Za-z0-9_-]{6,})/g)];
    if (named.length > 0) {
      for (const item of named) ids.push(item[1] ?? "");
      continue;
    }
    for (const part of body.split("|")) {
      const value = part.trim();
      if (/^[A-Za-z0-9_-]{6,}$/.test(value)) ids.push(value);
    }
  }
  const links = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/gi;
  for (const match of wikitext.matchAll(links)) ids.push(match[1] ?? "");
  const videos = [];
  const seen = /* @__PURE__ */ new Set();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    videos.push({ provider: "youtube", id, url: `https://www.youtube.com/watch?v=${id}` });
  }
  return videos;
}
function parseImageToc(wikitext) {
  const match = /\{\{\s*ImageTOC\b([\s\S]*?)\}\}/i.exec(wikitext);
  if (!match) return [];
  const entries = [];
  for (const line of (match[1] ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const parts = trimmed.slice(1).split("|");
    entries.push({
      file: (parts[0] ?? "").trim(),
      label: parts.slice(1).join("|").trim()
    });
  }
  return entries;
}
function extractLinkedSubpages(wikitext) {
  const found = [];
  const seen = /* @__PURE__ */ new Set();
  const re = /\{\{\s*(\/[^{}|]+?)\s*\}\}/g;
  for (const match of wikitext.matchAll(re)) {
    const sub = (match[1] ?? "").trim();
    const key = sub.toLowerCase();
    if (!sub || seen.has(key)) continue;
    seen.add(key);
    found.push(sub);
  }
  return found;
}
function productionLogosSubpage(subpages) {
  return subpages.find((sub) => /production\s*logos/i.test(sub)) ?? subpages.find((sub) => /^\/logos$/i.test(sub)) ?? null;
}
var LABEL_RE = /'''\s*([^'\n]{1,80}?)\s*:(?:\s*\{\{[^{}\n]*\}\})?\s*'''/g;
function splitSubsections(body) {
  const matches = [...body.matchAll(LABEL_RE)];
  if (matches.length === 0) {
    const text = body.trim();
    return text ? [{ title: "Overview", raw: text }] : [];
  }
  const sections = [];
  const first = matches[0];
  const preamble = body.slice(0, first?.index ?? 0).trim();
  if (preamble && /[A-Za-z0-9]/.test(stripMarkupForCheck(preamble))) {
    sections.push({ title: "Overview", raw: preamble });
  }
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    if (!current) continue;
    const start = (current.index ?? 0) + current[0].length;
    const next = matches[i + 1];
    const end = next ? next.index ?? body.length : body.length;
    sections.push({ title: (current[1] ?? "").trim(), raw: body.slice(start, end) });
  }
  return sections;
}
function stripMarkupForCheck(input) {
  return input.replace(/<[^>]+>/g, "").replace(/\{\{[^{}]*\}\}/g, "").replace(/[\[\]'|{}]/g, "");
}
function subsectionsFromBody(body) {
  const withoutMedia = stripMediaBlocks(body);
  return splitSubsections(withoutMedia).map((section) => {
    const text = wikitextToPlain(section.raw);
    return {
      key: canonicalSectionKey(section.title),
      title: section.title,
      text
    };
  }).filter((section) => section.text.length > 0);
}
function groupLogoText(subsections) {
  const buckets = /* @__PURE__ */ new Map();
  for (const section of subsections) {
    if (!KNOWN_KEYS.has(section.key) || section.key === "overview") continue;
    const list = buckets.get(section.key) ?? [];
    list.push(section.text);
    buckets.set(section.key, list);
  }
  const overview = subsections.find((section) => section.key === "overview")?.text ?? null;
  const description = joinText(buckets.get("visuals")) ?? overview;
  return {
    description,
    variants: joinText(buckets.get("variants")),
    technique: joinText(buckets.get("technique")),
    audio: joinText(buckets.get("audio")),
    availability: joinText(buckets.get("availability")),
    trivia: joinText(buckets.get("trivia"))
  };
}
function joinText(parts) {
  if (!parts || parts.length === 0) return null;
  const text = parts.map((part) => part.trim()).filter(Boolean).join("\n\n");
  return text || null;
}
function wikitextToPlain(input) {
  let text = input.replace(/\r\n/g, "\n");
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "");
  text = text.replace(/<ref\b[^>]*\/>/gi, "");
  text = expandDateTemplates(text);
  text = stripMediaBlocks(text);
  text = text.replace(/\[\[Category:[^\]]+\]\]/gi, "");
  text = removeTemplates(text);
  text = text.replace(/\[\[(?:[^\]|#]+)#(?:[^\]|]+)\|([^\]]+)\]\]/g, "$1");
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
  text = text.replace(/\[\[([^\]|#]+)(?:#[^\]]+)?\]\]/g, (_m, target) => displayLink(target));
  text = text.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1");
  text = text.replace(/\[https?:\/\/[^\s\]]+\]/g, "");
  text = text.replace(/'''/g, "");
  text = text.replace(/''/g, "");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<li[^>]*>/gi, "\n* ");
  text = text.replace(/<[^>]+>/g, "");
  text = decodeEntities(text);
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\(\s*years ago\s*\)/gi, "");
  text = unwrapLines(text);
  text = text.replace(/[ \t]{2,}/g, " ");
  return text.trim();
}
function unwrapLines(input) {
  const output = [];
  for (const line of input.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (output[output.length - 1] !== "") output.push("");
      continue;
    }
    const previous = output.length > 0 ? output[output.length - 1] : void 0;
    const isList = /^[*#]/.test(trimmed);
    if (previous && previous !== "" && !isList) {
      output[output.length - 1] = `${previous} ${trimmed}`;
    } else {
      output.push(trimmed);
    }
  }
  return output.join("\n").replace(/\n{3,}/g, "\n\n");
}
function stripMediaBlocks(input) {
  let text = input.replace(/<tabber\b[^>]*>[\s\S]*?<\/tabber>/gi, "");
  text = text.replace(/<gallery\b[^>]*>[\s\S]*?<\/gallery>/gi, "");
  text = removeBalancedTemplate(text, "#tag:tabber");
  text = text.replace(/\[\[(?:File|Image):[^\]]+\]\]/gi, "");
  text = text.replace(/\{\{\s*youtube\b[^{}]*\}\}/gi, "");
  return text;
}
function removeTemplates(input) {
  let text = input;
  const inner = /\{\{[^{}]*\}\}/g;
  let previous = "";
  while (text !== previous) {
    previous = text;
    text = text.replace(inner, "");
  }
  return text;
}
function removeBalancedTemplate(input, name) {
  const re = new RegExp(`\\{\\{\\s*${escapeRegExp(name)}\\b`, "i");
  const match = re.exec(input);
  if (!match || match.index === void 0) return input;
  const end = findTemplateEnd(input, match.index);
  if (end === -1) return input;
  return input.slice(0, match.index) + input.slice(end);
}
function extractTemplate(input, name) {
  const re = new RegExp(`\\{\\{\\s*${escapeRegExp(name)}\\b`, "i");
  const match = re.exec(input);
  if (!match || match.index === void 0) return null;
  const end = findTemplateEnd(input, match.index);
  if (end === -1) return null;
  return input.slice(match.index, end);
}
function findTemplateEnd(input, start) {
  let depth = 0;
  for (let i = start; i < input.length - 1; i += 1) {
    if (input[i] === "{" && input[i + 1] === "{") {
      depth += 1;
      i += 1;
      continue;
    }
    if (input[i] === "}" && input[i + 1] === "}") {
      depth -= 1;
      i += 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}
function parseInfoboxFields(template) {
  const inner = template.replace(/^\{\{/, "").replace(/\}\}$/, "");
  const fields = {};
  let current = null;
  for (const line of inner.split("\n")) {
    const match = /^\s*\|([^=]+)=(.*)$/.exec(line);
    if (match) {
      current = (match[1] ?? "").trim().toLowerCase();
      fields[current] = (match[2] ?? "").trim();
      continue;
    }
    if (current && line.trim() && !line.trim().startsWith("}}")) {
      fields[current] = `${fields[current] ?? ""} ${line.trim()}`.trim();
    }
  }
  return fields;
}
function cleanInline(value) {
  return wikitextToPlain(value).replace(/\s+/g, " ").trim();
}
function splitBreaks(value) {
  return value.split(/<br\s*\/?>/i).map((part) => cleanInline(part)).filter(Boolean);
}
function displayLink(target) {
  const trimmed = target.trim().replace(/_/g, " ");
  const colon = trimmed.indexOf(":");
  if (colon > 0 && !trimmed.slice(0, colon).includes(" ")) {
    return trimmed.slice(colon + 1).trim();
  }
  return trimmed;
}
function stripFilePrefix(name) {
  return name.replace(/^(?:File|Image):/i, "").trim();
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function hasVariationsTemplate(wikitext) {
  return /\{\{\s*Variations\b/i.test(wikitext);
}

// src/parse/heading.ts
var LOGO_RE = /^(\d+)(st|nd|rd|th)\s+logo\b([\s\S]*)$/i;
var MONTH_OR_YEAR = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|\d{4})\b/i;
function parseLogoHeading(rawHeading) {
  const heading = cleanHeading(rawHeading);
  const match = LOGO_RE.exec(heading);
  if (!match) return null;
  const ordinal = Number(match[1]);
  const ordinalLabel = `${match[1]}${(match[2] ?? "").toLowerCase()}`;
  const groups = parenGroups(match[3] ?? "");
  let dateText = null;
  const labels = [];
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
    dateRanges: ranges
  };
}
function cleanHeading(raw) {
  let text = raw.trim();
  text = text.replace(/^={2,6}\s*/, "").replace(/\s*={2,6}$/, "");
  text = expandDateTemplates(text);
  text = stripHtml(text);
  text = text.replace(/'''/g, "").replace(/''/g, "");
  text = text.replace(/\u00a0/g, " ");
  text = text.replace(/[ \t]+/g, " ").trim();
  return text;
}
function looksLikeDate(value) {
  return MONTH_OR_YEAR.test(value) || /\d\s*-\s*$/.test(value);
}
function parenGroups(input) {
  const groups = [];
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
function parseVariantLabel(label) {
  if (!label || !/custom variant/i.test(label)) {
    return { isCustomVariant: false, gameTitle: null, gameTitles: [], qualifiers: [] };
  }
  let text = label.replace(/\s*custom variant\s*$/i, "").trim();
  text = text.replace(/'''/g, "").replace(/''/g, "").replace(/\s+/g, " ").trim();
  const qualifiers = [];
  const titles = [];
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
    qualifiers
  };
}
function stripQualifier(value, qualifiers) {
  const match = /^(.*?)(?:\s+(prototypes?|series))\s*$/i.exec(value.trim());
  if (match && (match[1] ?? "").trim()) {
    qualifiers.push((match[2] ?? "").toLowerCase());
    return (match[1] ?? "").trim();
  }
  return value.trim();
}
function dedupe(values) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const value of values) {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}
function anchorFromHeading(heading) {
  return heading.replace(/ /g, "_");
}

// src/parse/company.ts
function parseCompanyWikitext(wikitext, options = {}) {
  const siteUrl = options.siteUrl ?? AVID_SITE_URL;
  const title = options.title ?? "Unknown";
  const { intro, sections } = splitWikiSections(wikitext);
  const infobox = readInfobox(intro);
  const description = readDescription(intro);
  const linkedSubpages = extractLinkedSubpages(wikitext);
  const toc = parseImageToc(wikitext);
  const anchors = anchorsByOrdinal(options.sections ?? []);
  const warnings = [];
  if (hasVariationsTemplate(wikitext)) {
    warnings.push(
      "This page transcludes {{Variations}} subpages. That extra variation text is not expanded."
    );
  }
  const logos = [];
  for (const section of sections) {
    const parsed = parseLogoHeading(section.heading);
    if (!parsed) continue;
    const images = extractImages(section.body, siteUrl);
    const tocEntry = toc.find((entry) => ordinalOf(entry.label) === parsed.ordinal);
    const primary = placePrimaryImage(images, tocEntry?.file, siteUrl);
    const subsections = subsectionsFromBody(section.body);
    if (parsed.dateText && parsed.dateRanges.some((range) => range.kind === "unknown")) {
      warnings.push(`Could not fully parse dates for ${parsed.ordinalLabel} Logo: ${parsed.dateText}`);
    }
    const anchorList = anchors.get(parsed.ordinal);
    const anchor = anchorList && anchorList.length > 0 ? anchorList.shift() ?? "" : anchorFromHeading(parsed.heading);
    logos.push({
      index: logos.length,
      ordinal: parsed.ordinal,
      ordinalLabel: parsed.ordinalLabel,
      heading: parsed.heading,
      rawHeading: section.heading.trim(),
      anchor,
      label: parsed.label,
      isCustomVariant: parsed.isCustomVariant,
      gameTitle: parsed.gameTitle,
      gameTitles: parsed.gameTitles,
      qualifiers: parsed.qualifiers,
      dateText: parsed.dateText,
      dateRanges: parsed.dateRanges,
      subsections,
      text: groupLogoText(subsections),
      images,
      primaryImage: primary,
      videos: extractVideos(section.body)
    });
  }
  const contentTitle = options.contentTitle ?? title;
  const categories = options.categories ?? categoriesFromWikitext(wikitext);
  return {
    title,
    companyName: infobox?.name || firstBold(intro) || title.split("/")[0] || title,
    pageId: options.pageId ?? null,
    url: options.url ?? attributionFor(title, siteUrl).sourceUrl,
    contentUrl: attributionFor(contentTitle, siteUrl).sourceUrl,
    description,
    infobox,
    companyLogo: infobox?.image ? toLogoImage(infobox.image, siteUrl) : null,
    logos,
    categories,
    linkedSubpages,
    sources: options.sources ?? [contentTitle],
    warnings,
    attribution: attributionFor(contentTitle, siteUrl),
    retrievedAt: options.retrievedAt ?? (/* @__PURE__ */ new Date()).toISOString()
  };
}
function categoriesFromWikitext(wikitext) {
  const categories = [];
  const seen = /* @__PURE__ */ new Set();
  for (const match of wikitext.matchAll(/\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi)) {
    const title = (match[1] ?? "").replace(/_/g, " ").trim();
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    categories.push({ title, hidden: false });
  }
  return categories;
}
function mapApiCategories(categories) {
  if (!Array.isArray(categories)) return [];
  const out = [];
  for (const category of categories) {
    if (typeof category === "string") {
      out.push({ title: category.replace(/_/g, " ").replace(/^Category:/i, ""), hidden: false });
      continue;
    }
    if (!category || typeof category !== "object") continue;
    const record = category;
    const raw = record.category ?? record["*"] ?? record.title;
    if (typeof raw !== "string") continue;
    out.push({
      title: raw.replace(/_/g, " ").replace(/^Category:/i, ""),
      hidden: Boolean(record.hidden)
    });
  }
  return out;
}
function splitWikiSections(wikitext) {
  const re = /^(={2,6})\s*(.*?)\s*\1[ \t]*$/gm;
  const matches = [...wikitext.matchAll(re)];
  if (matches.length === 0) return { intro: wikitext, sections: [] };
  const intro = wikitext.slice(0, matches[0]?.index ?? 0);
  const sections = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    if (!match) continue;
    const bodyStart = (match.index ?? 0) + match[0].length;
    const next = matches[i + 1];
    const bodyEnd = next ? next.index ?? wikitext.length : wikitext.length;
    sections.push({
      level: (match[1] ?? "").length,
      heading: (match[2] ?? "").trim(),
      body: wikitext.slice(bodyStart, bodyEnd)
    });
  }
  return { intro, sections };
}
function readInfobox(intro) {
  const template = extractTemplate(intro, "Infobox company");
  if (!template) return null;
  const fields = parseInfoboxFields(template);
  return {
    name: fields.name ? cleanInline(fields.name) : null,
    founded: fields.founded ? cleanInline(fields.founded) : null,
    country: fields.country ? cleanInline(fields.country) : null,
    parent: fields.parent ? cleanInline(fields.parent) : null,
    formerly: fields.formerly ? splitBreaks(fields.formerly) : [],
    image: fields.image ? fields.image.replace(/^File:/i, "").trim() : null
  };
}
function readDescription(intro) {
  let text = intro;
  text = removeBalancedTemplate(text, "Infobox company");
  const plain = wikitextToPlain(text);
  const paragraph = plain.split(/\n\s*\n/).map((part) => part.replace(/\s+/g, " ").trim()).find((part) => part.length > 40);
  return paragraph ?? null;
}
function firstBold(intro) {
  const match = /'''([^'\n]+)'''/.exec(intro);
  return match?.[1]?.trim() ?? null;
}
function ordinalOf(label) {
  const match = /^\s*(\d+)(?:st|nd|rd|th)\b/i.exec(label);
  return match ? Number(match[1]) : null;
}
function anchorsByOrdinal(sections) {
  const map = /* @__PURE__ */ new Map();
  for (const section of sections) {
    const text = section.line.replace(/<[^>]+>/g, "").replace(/\u00a0/g, " ");
    const match = /^\s*(\d+)(?:st|nd|rd|th)\s+logo\b/i.exec(text);
    if (!match) continue;
    const ordinal = Number(match[1]);
    const list = map.get(ordinal) ?? [];
    list.push(section.anchor);
    map.set(ordinal, list);
  }
  return map;
}
function placePrimaryImage(images, file, siteUrl) {
  if (file && file.trim()) {
    const image = toLogoImage(file, siteUrl);
    const key = image.title.toLowerCase();
    const existing = images.findIndex((item) => item.title.toLowerCase() === key);
    if (existing === -1) images.unshift(image);
    else if (existing > 0) {
      const [found] = images.splice(existing, 1);
      if (found) images.unshift(found);
    }
    return images[0] ?? image;
  }
  return images[0] ?? null;
}

// src/client.ts
var AvidWikiClient = class {
  apiUrl;
  siteUrl;
  userAgent;
  maxlag;
  retries;
  retryBaseDelayMs;
  cache;
  cacheTtlMs;
  fetchImpl;
  origin;
  gate;
  constructor(options = {}) {
    this.apiUrl = options.apiUrl ?? AVID_API_URL;
    this.siteUrl = (options.siteUrl ?? AVID_SITE_URL).replace(/\/$/, "");
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.maxlag = options.maxlag ?? 5;
    this.retries = options.retries ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 400;
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1e3;
    this.cache = options.cache === true ? new MemoryCache(this.cacheTtlMs) : options.cache ? options.cache : null;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.origin = options.origin === false ? false : options.origin ?? "*";
    this.gate = new RequestGate(options.maxConcurrency ?? 2, options.minIntervalMs ?? 250);
  }
  /** Low-level Action API call. Parameters are sent as an encoded POST body. */
  async request(params) {
    const query = this.buildParams(params);
    const key = stableKey(query);
    if (this.cache) {
      const hit = await this.cache.get(key);
      if (hit !== void 0) return JSON.parse(hit);
    }
    const text = await this.gate.run(() => this.fetchWithRetry(query));
    if (this.cache) await this.cache.set(key, text, this.cacheTtlMs);
    return JSON.parse(text);
  }
  /** Full-text search (`list=search`). */
  async searchPages(query, options = {}) {
    const data = await this.request({
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: clampLimit(options.limit, 10, 50),
      sroffset: options.offset,
      srnamespace: joinNs(options.namespace ?? 0),
      srprop: "snippet|size|wordcount|timestamp"
    });
    const results = (data.query?.search ?? []).map((hit) => ({
      title: hit.title,
      pageId: hit.pageid,
      url: pageUrl(hit.title, this.siteUrl),
      snippet: hit.snippet ?? "",
      snippetText: stripHtml(hit.snippet ?? "").replace(/\s+/g, " ").trim(),
      wordCount: hit.wordcount ?? 0,
      size: hit.size ?? 0,
      timestamp: hit.timestamp ?? ""
    }));
    const offset = typeof data.continue?.sroffset === "number" ? data.continue.sroffset : null;
    return { results, offset };
  }
  /**
   * One article: wikitext, HTML, table of contents, categories, and image file names.
   * Redirects are followed unless `redirects` is false.
   */
  async getPage(title, options = {}) {
    const wantHtml = options.html !== false;
    const props = ["wikitext", "categories", "images", "tocdata", "displaytitle", "revid"];
    if (wantHtml) props.push("text");
    const data = await this.request({
      action: "parse",
      page: title,
      prop: props.join("|"),
      redirects: options.redirects === false ? void 0 : 1
    });
    const parse = data.parse;
    if (!parse?.title || parse.pageid === void 0) {
      throw new AvidError(`No parse result for "${title}"`, { code: "bad-response" });
    }
    const resolved = parse.title;
    const sections = mapSections(parse);
    return {
      title: resolved,
      pageId: parse.pageid,
      url: pageUrl(resolved, this.siteUrl),
      wikitext: readStringField(parse.wikitext),
      html: wantHtml ? readStringField(parse.text) || null : null,
      sections,
      categories: mapApiCategories(parse.categories),
      images: mapImageNames(parse.images),
      revisionId: typeof parse.revid === "number" ? parse.revid : null,
      redirectedFrom: parse.redirects?.[0]?.from && parse.redirects[0].from !== resolved ? parse.redirects[0].from : null,
      displayTitle: stripHtml(parse.displaytitle ?? resolved).replace(/\s+/g, " ").trim() || resolved,
      attribution: attributionFor(resolved, this.siteUrl)
    };
  }
  /** One page of `list=categorymembers`, including the continuation token. */
  async listCategoryMembers(category, options = {}) {
    const title = /^category:/i.test(category) ? category : `Category:${category}`;
    const data = await this.request({
      action: "query",
      list: "categorymembers",
      cmtitle: title,
      cmlimit: clampLimit(options.limit, 50, 500),
      cmcontinue: options.continue,
      cmnamespace: options.namespace === void 0 ? void 0 : joinNs(options.namespace),
      cmtype: options.type
    });
    const members = (data.query?.categorymembers ?? []).map((member) => ({
      title: member.title,
      pageId: member.pageid,
      namespace: member.ns,
      url: pageUrl(member.title, this.siteUrl)
    }));
    return { members, continue: data.continue?.cmcontinue ?? null };
  }
  /** Every member of a category. Each page waits on the client's throttle. */
  async *iterateCategoryMembers(category, options = {}) {
    let token;
    do {
      const page = await this.listCategoryMembers(category, { ...options, continue: token });
      for (const member of page.members) yield member;
      token = page.continue ?? void 0;
    } while (token);
  }
  /**
   * Companies filed under Category:Video game logos.
   * This is the wiki's category, so it can include a few pages that are not studios.
   * Results come one API page at a time; pass `continue` for the next page.
   */
  async listVideoGameLogoCompanies(options = {}) {
    const page = await this.listCategoryMembers("Category:Video game logos", {
      limit: options.limit ?? 50,
      continue: options.continue,
      namespace: 0,
      type: "page"
    });
    const exclude = options.excludeSubpages !== false;
    return {
      companies: page.members.filter((member) => exclude ? !member.title.includes("/") : true).map((member) => ({ title: member.title, pageId: member.pageId, url: member.url })),
      continue: page.continue
    };
  }
  /** Resolve titles, following redirects. Missing pages come back with `pageId: null`. */
  async resolveRedirects(titles) {
    if (titles.length === 0) return [];
    const data = await this.request({
      action: "query",
      titles: titles.join("|"),
      redirects: 1,
      prop: "info",
      inprop: "url"
    });
    const redirects = /* @__PURE__ */ new Map();
    for (const redirect of data.query?.redirects ?? []) {
      if (redirect.from && redirect.to) redirects.set(redirect.from, redirect.to);
    }
    const normalized = /* @__PURE__ */ new Map();
    for (const item of data.query?.normalized ?? []) {
      if (item.from && item.to) normalized.set(item.from, item.to);
    }
    const byTitle = /* @__PURE__ */ new Map();
    for (const page of data.query?.pages ?? []) byTitle.set(page.title, page);
    return titles.map((from) => {
      let current = from;
      const seen = /* @__PURE__ */ new Set();
      while (!seen.has(current)) {
        seen.add(current);
        const next = redirects.get(current) ?? normalized.get(current);
        if (!next || next === current) break;
        current = next;
      }
      const page = byTitle.get(current);
      const to = page?.title ?? current;
      return {
        from,
        to,
        pageId: page && !page.missing ? page.pageid : null,
        url: pageUrl(to, this.siteUrl),
        redirected: from !== to
      };
    });
  }
  /** Image and file metadata, including original URLs. Titles may be file names or `File:` titles. */
  async getFileInfo(files, options = {}) {
    const list = (Array.isArray(files) ? files : [files]).map((file) => fileTitle(file));
    const unique = [];
    const seen = /* @__PURE__ */ new Set();
    for (const title of list) {
      const key = fileKey(title);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(title);
    }
    const pages = [];
    for (let i = 0; i < unique.length; i += 50) {
      const batch = unique.slice(i, i + 50);
      const data = await this.request({
        action: "query",
        titles: batch.join("|"),
        prop: "imageinfo",
        iiprop: "url|size|mime|mediatype|extmetadata",
        iiurlwidth: options.thumbWidth
      });
      pages.push(...data.query?.pages ?? []);
    }
    const byKey = /* @__PURE__ */ new Map();
    for (const page of pages) byKey.set(fileKey(page.title), page);
    return unique.map((title) => toFileInfo(title, byKey.get(fileKey(title)), this.siteUrl));
  }
  /**
   * Structured logo eras for a company page.
   * Sega-style articles are parsed directly. Nintendo-style articles that only
   * transclude `{{/Production Logos}}` follow that subpage.
   */
  async getCompany(title, options = {}) {
    const page = await this.getPage(title, { html: false });
    const parent = this.parsePage(page);
    let company = parent;
    if (parent.logos.length === 0 && options.followSubpages !== false) {
      const sub = productionLogosSubpage(parent.linkedSubpages);
      if (sub) {
        const child = await this.getPage(`${page.title}${sub}`, { html: false });
        const parsed = this.parsePage(child, page.title);
        company = {
          ...parsed,
          title: page.title,
          companyName: parent.infobox?.name || parent.companyName,
          pageId: page.pageId,
          url: page.url,
          description: parent.description ?? parsed.description,
          infobox: parent.infobox ?? parsed.infobox,
          companyLogo: parent.companyLogo ?? parsed.companyLogo,
          categories: mergeCategories(parent.categories, parsed.categories),
          linkedSubpages: parent.linkedSubpages,
          sources: dedupeTitles([page.title, child.title]),
          warnings: [...parent.warnings, ...parsed.warnings],
          attribution: parsed.attribution
        };
      }
    }
    if (options.resolveImages) {
      company = await this.attachImageInfo(company, options.thumbWidth);
    }
    return company;
  }
  parsePage(page, title = page.title) {
    const categories = page.categories.length > 0 ? page.categories : categoriesFromWikitext(page.wikitext);
    return parseCompanyWikitext(page.wikitext, {
      title,
      pageId: page.pageId,
      url: pageUrl(title, this.siteUrl),
      contentTitle: page.title,
      categories,
      siteUrl: this.siteUrl,
      sections: page.sections.map((section) => ({ line: section.line, anchor: section.anchor })),
      sources: [page.title]
    });
  }
  async attachImageInfo(company, thumbWidth) {
    const titles = [];
    if (company.companyLogo) titles.push(company.companyLogo.title);
    for (const logo of company.logos) {
      for (const image of logo.images) titles.push(image.title);
    }
    if (titles.length === 0) return company;
    const infos = await this.getFileInfo(titles, thumbWidth ? { thumbWidth } : {});
    const byKey = new Map(infos.map((info) => [fileKey(info.title), info]));
    const fill = (image) => {
      if (!image) return image;
      return byKey.get(fileKey(image.title)) ?? image;
    };
    return {
      ...company,
      companyLogo: fill(company.companyLogo),
      logos: company.logos.map((logo) => {
        const images = logo.images.map((image) => byKey.get(fileKey(image.title)) ?? image);
        const primary = logo.primaryImage ? byKey.get(fileKey(logo.primaryImage.title)) ?? logo.primaryImage : null;
        return { ...logo, images, primaryImage: primary };
      })
    };
  }
  buildParams(params) {
    const query = {
      format: "json",
      formatversion: "2"
    };
    if (this.maxlag > 0) query.maxlag = String(this.maxlag);
    if (this.origin !== false) query.origin = this.origin;
    for (const [key, value] of Object.entries(params)) {
      if (value === void 0 || value === "") continue;
      query[key] = typeof value === "boolean" ? value ? "1" : "0" : String(value);
    }
    return query;
  }
  async fetchWithRetry(query) {
    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const response = await this.fetchImpl(this.apiUrl, {
          method: "POST",
          headers: identityHeaders(this.userAgent),
          body: new URLSearchParams(query)
        });
        const text = await response.text();
        const data = tryParse(text);
        const code = data?.error?.code;
        const retryable = attempt < this.retries && (response.status === 429 || response.status >= 500 || code === "maxlag" || code === "ratelimited");
        if (retryable) {
          await sleep(this.delayFor(attempt, response));
          continue;
        }
        if (!response.ok || code) {
          throw new AvidError(data?.error?.info || response.statusText || "AVID API request failed", {
            code: code || `http-${response.status}`,
            status: response.status
          });
        }
        if (!data) throw new AvidError("AVID API returned a non-JSON response", { code: "bad-json", status: response.status });
        return text;
      } catch (error) {
        if (error instanceof AvidError) throw error;
        lastError = error;
        if (attempt >= this.retries) {
          throw new AvidError(error instanceof Error ? error.message : "Network request failed", {
            code: "network",
            cause: error
          });
        }
        await sleep(this.delayFor(attempt));
      }
    }
    throw new AvidError(lastError instanceof Error ? lastError.message : "AVID API request failed", {
      code: "network",
      cause: lastError
    });
  }
  delayFor(attempt, response) {
    const header = response?.headers.get("retry-after");
    if (header && /^\d+$/.test(header.trim())) {
      const seconds = Number(header.trim());
      if (this.retryBaseDelayMs === 0) return 0;
      return seconds * 1e3;
    }
    if (this.retryBaseDelayMs === 0) return 0;
    return this.retryBaseDelayMs * 2 ** attempt;
  }
};
function createAvidClient(options) {
  return new AvidWikiClient(options);
}
function identityHeaders(userAgent) {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
  headers.set("Api-User-Agent", userAgent);
  try {
    headers.set("User-Agent", userAgent);
  } catch {
  }
  return headers;
}
function stableKey(query) {
  return Object.keys(query).sort().map((key) => `${key}=${query[key]}`).join("&");
}
function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
function readStringField(value) {
  if (typeof value === "string") return value;
  if (value && typeof value["*"] === "string") return value["*"];
  return "";
}
function mapSections(parse) {
  const list = parse.tocdata?.sections ?? parse.sections ?? [];
  return list.map((section, index) => {
    const line = section.line ?? "";
    return {
      index: Number(section.index ?? index + 1),
      tocLevel: Number(section.tocLevel ?? 1),
      level: Number(section.hLevel ?? section.level ?? 2),
      line,
      text: stripHtml(line).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim(),
      number: String(section.number ?? ""),
      anchor: section.anchor ?? ""
    };
  });
}
function mapImageNames(images) {
  if (!Array.isArray(images)) return [];
  const names = [];
  for (const image of images) {
    if (typeof image === "string") names.push(image);
    else if (image && typeof image === "object" && "title" in image) {
      const title = image.title;
      if (typeof title === "string") names.push(title.replace(/^File:/i, ""));
    }
  }
  return names;
}
function clampLimit(value, fallback, max) {
  const limit = value ?? fallback;
  if (!Number.isFinite(limit)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(limit)));
}
function joinNs(namespace) {
  return (Array.isArray(namespace) ? namespace : [namespace]).join("|");
}
function mergeCategories(left, right) {
  const out = [...left];
  const seen = new Set(left.map((category) => category.title.toLowerCase()));
  for (const category of right) {
    const key = category.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(category);
  }
  return out;
}
function dedupeTitles(titles) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const title of titles) {
    if (seen.has(title)) continue;
    seen.add(title);
    out.push(title);
  }
  return out;
}
function toFileInfo(requested, page, siteUrl) {
  const info = page?.imageinfo?.[0];
  const title = page?.title ?? requested;
  const meta = info?.extmetadata ?? {};
  const missing = !info;
  return {
    name: title.replace(/^File:/i, ""),
    title,
    pageUrl: pageUrl(title, siteUrl),
    url: info?.url ?? null,
    descriptionUrl: info?.descriptionurl ?? null,
    mime: info?.mime ?? null,
    mediatype: info?.mediatype ?? null,
    width: info?.width ?? null,
    height: info?.height ?? null,
    size: info?.size ?? null,
    thumbUrl: info?.thumburl ?? null,
    licenseShortName: metaText(meta.LicenseShortName),
    usageTerms: metaText(meta.UsageTerms),
    artist: metaText(meta.Artist),
    credit: metaText(meta.Credit),
    missing,
    repository: page?.imagerepository ?? null
  };
}
function metaText(entry) {
  if (!entry?.value) return null;
  const text = stripHtml(entry.value).replace(/\s+/g, " ").trim();
  return text || null;
}

// src/collectors.ts
function findLogosCoveringDate(source, date) {
  const logos = Array.isArray(source) ? source : source.logos;
  const query = dateWindow(date);
  return logos.filter(
    (logo) => logo.dateRanges.some((range) => {
      const bounds = rangeBounds(range);
      if (!bounds) return false;
      return query.start <= bounds.end && query.end >= bounds.start;
    })
  );
}
function findLogosByGame(source, query, options = {}) {
  const logos = Array.isArray(source) ? source : source.logos;
  const needle = normalizeTitle(query);
  if (!needle) return [];
  const titleMatches = [];
  const textMatches = [];
  for (const logo of logos) {
    const titleHit = logo.gameTitles.some((title) => titlesMatch(needle, normalizeTitle(title)));
    if (titleHit) {
      titleMatches.push({ logo, match: "title" });
      continue;
    }
    if (options.searchText === false) continue;
    const haystack = normalizeTitle(
      [logo.label, logo.text.description, logo.text.variants, logo.text.availability].filter(Boolean).join("\n")
    );
    if (haystack.includes(needle)) textMatches.push({ logo, match: "text" });
  }
  return [...titleMatches, ...textMatches];
}
function dateWindow(date) {
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
function titlesMatch(needle, title) {
  if (!title) return false;
  if (title.includes(needle)) return true;
  return title.length >= 4 && needle.includes(title);
}
function normalizeTitle(value) {
  return value.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}
function yearWindow(year) {
  return { start: Date.UTC(year, 0, 1), end: Date.UTC(year, 11, 31, 23, 59, 59, 999) };
}
function monthWindow(year, month) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: Date.UTC(year, month - 1, 1),
    end: Date.UTC(year, month - 1, last, 23, 59, 59, 999)
  };
}
function dayWindow(year, month, day) {
  return {
    start: Date.UTC(year, month - 1, day),
    end: Date.UTC(year, month - 1, day, 23, 59, 59, 999)
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ATTRIBUTION_REQUIREMENTS,
  AVID_API_URL,
  AVID_SITE_NAME,
  AVID_SITE_URL,
  AvidError,
  AvidWikiClient,
  CC_BY_SA_4_0,
  DEFAULT_USER_AGENT,
  MemoryCache,
  VERSION,
  attributionFor,
  createAvidClient,
  expandDateTemplates,
  filePageUrl,
  fileTitle,
  findLogosByGame,
  findLogosCoveringDate,
  mapApiCategories,
  pageUrl,
  parseCompanyWikitext,
  parseDateRanges,
  parseLogoHeading
});
