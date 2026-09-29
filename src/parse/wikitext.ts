import { filePageUrl, fileTitle } from "../attribution.js";
import type { LogoImage, LogoSubsection, LogoText, LogoVideo } from "../types.js";
import { expandDateTemplates } from "./dates.js";

const KNOWN_KEYS = new Set([
  "visuals",
  "variants",
  "technique",
  "audio",
  "availability",
  "trivia",
  "overview",
]);

/** Map a bold subsection label onto a stable key. */
export function canonicalSectionKey(title: string): string {
  const compact = title.toLowerCase().replace(/[^a-z]/g, "");
  const aliases: Record<string, string> = {
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
    overview: "overview",
  };
  return (
    aliases[compact] ??
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

export function stripHtml(input: string): string {
  return decodeEntities(input.replace(/<[^>]+>/g, ""));
}

export function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_m, dec: string) => safeChar(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => safeChar(Number.parseInt(hex, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'");
}

function safeChar(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  return String.fromCodePoint(code);
}

export function fileKey(name: string): string {
  return name
    .replace(/^File:/i, "")
    .replace(/^Image:/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function toLogoImage(name: string, siteUrl?: string): LogoImage {
  const cleaned = name.trim();
  return {
    name: cleaned,
    title: fileTitle(cleaned),
    pageUrl: filePageUrl(cleaned, siteUrl),
  };
}

/** Pull gallery rows and `[[File:]]` / `[[Image:]]` links out of a section. */
export function extractImages(wikitext: string, siteUrl?: string): LogoImage[] {
  const names: string[] = [];
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
  const images: LogoImage[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const key = fileKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    images.push(toLogoImage(name, siteUrl));
  }
  return images;
}

export function extractVideos(wikitext: string): LogoVideo[] {
  const ids: string[] = [];
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

  const videos: LogoVideo[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    videos.push({ provider: "youtube", id, url: `https://www.youtube.com/watch?v=${id}` });
  }
  return videos;
}

export interface ImageTocEntry {
  file: string;
  label: string;
}

export function parseImageToc(wikitext: string): ImageTocEntry[] {
  const match = /\{\{\s*ImageTOC\b([\s\S]*?)\}\}/i.exec(wikitext);
  if (!match) return [];
  const entries: ImageTocEntry[] = [];
  for (const line of (match[1] ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    const parts = trimmed.slice(1).split("|");
    entries.push({
      file: (parts[0] ?? "").trim(),
      label: parts.slice(1).join("|").trim(),
    });
  }
  return entries;
}

export function extractLinkedSubpages(wikitext: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
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

export function productionLogosSubpage(subpages: string[]): string | null {
  return (
    subpages.find((sub) => /production\s*logos/i.test(sub)) ??
    subpages.find((sub) => /^\/logos$/i.test(sub)) ??
    null
  );
}

const LABEL_RE = /'''\s*([^'\n]{1,80}?)\s*:(?:\s*\{\{[^{}\n]*\}\})?\s*'''/g;

export function splitSubsections(body: string): Array<{ title: string; raw: string }> {
  const matches = [...body.matchAll(LABEL_RE)];
  if (matches.length === 0) {
    const text = body.trim();
    return text ? [{ title: "Overview", raw: text }] : [];
  }
  const sections: Array<{ title: string; raw: string }> = [];
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
    const end = next ? (next.index ?? body.length) : body.length;
    sections.push({ title: (current[1] ?? "").trim(), raw: body.slice(start, end) });
  }
  return sections;
}

function stripMarkupForCheck(input: string): string {
  return input.replace(/<[^>]+>/g, "").replace(/\{\{[^{}]*\}\}/g, "").replace(/[\[\]'|{}]/g, "");
}

export function subsectionsFromBody(body: string): LogoSubsection[] {
  const withoutMedia = stripMediaBlocks(body);
  return splitSubsections(withoutMedia)
    .map((section) => {
      const text = wikitextToPlain(section.raw);
      return {
        key: canonicalSectionKey(section.title),
        title: section.title,
        text,
      };
    })
    .filter((section) => section.text.length > 0);
}

export function groupLogoText(subsections: LogoSubsection[]): LogoText {
  const buckets = new Map<string, string[]>();
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
    trivia: joinText(buckets.get("trivia")),
  };
}

function joinText(parts: string[] | undefined): string | null {
  if (!parts || parts.length === 0) return null;
  const text = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
  return text || null;
}

/** Turn a chunk of wikitext into readable plain text. */
export function wikitextToPlain(input: string): string {
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
  text = text.replace(/\[\[([^\]|#]+)(?:#[^\]]+)?\]\]/g, (_m, target: string) => displayLink(target));
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

/** Join wrapped lines, and keep blank lines and wiki list items as breaks. */
function unwrapLines(input: string): string {
  const output: string[] = [];
  for (const line of input.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (output[output.length - 1] !== "") output.push("");
      continue;
    }
    const previous = output.length > 0 ? output[output.length - 1] : undefined;
    const isList = /^[*#]/.test(trimmed);
    if (previous && previous !== "" && !isList) {
      output[output.length - 1] = `${previous} ${trimmed}`;
    } else {
      output.push(trimmed);
    }
  }
  return output.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function stripMediaBlocks(input: string): string {
  let text = input.replace(/<tabber\b[^>]*>[\s\S]*?<\/tabber>/gi, "");
  text = text.replace(/<gallery\b[^>]*>[\s\S]*?<\/gallery>/gi, "");
  text = removeBalancedTemplate(text, "#tag:tabber");
  text = text.replace(/\[\[(?:File|Image):[^\]]+\]\]/gi, "");
  text = text.replace(/\{\{\s*youtube\b[^{}]*\}\}/gi, "");
  return text;
}

export function removeTemplates(input: string): string {
  let text = input;
  const inner = /\{\{[^{}]*\}\}/g;
  let previous = "";
  while (text !== previous) {
    previous = text;
    text = text.replace(inner, "");
  }
  return text;
}

/** Remove one named template, including nested braces. */
export function removeBalancedTemplate(input: string, name: string): string {
  const re = new RegExp(`\\{\\{\\s*${escapeRegExp(name)}\\b`, "i");
  const match = re.exec(input);
  if (!match || match.index === undefined) return input;
  const end = findTemplateEnd(input, match.index);
  if (end === -1) return input;
  return input.slice(0, match.index) + input.slice(end);
}

export function extractTemplate(input: string, name: string): string | null {
  const re = new RegExp(`\\{\\{\\s*${escapeRegExp(name)}\\b`, "i");
  const match = re.exec(input);
  if (!match || match.index === undefined) return null;
  const end = findTemplateEnd(input, match.index);
  if (end === -1) return null;
  return input.slice(match.index, end);
}

function findTemplateEnd(input: string, start: number): number {
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

export function parseInfoboxFields(template: string): Record<string, string> {
  const inner = template.replace(/^\{\{/, "").replace(/\}\}$/, "");
  const fields: Record<string, string> = {};
  let current: string | null = null;
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

export function cleanInline(value: string): string {
  return wikitextToPlain(value).replace(/\s+/g, " ").trim();
}

export function splitBreaks(value: string): string[] {
  return value
    .split(/<br\s*\/?>/i)
    .map((part) => cleanInline(part))
    .filter(Boolean);
}

function displayLink(target: string): string {
  const trimmed = target.trim().replace(/_/g, " ");
  const colon = trimmed.indexOf(":");
  if (colon > 0 && !trimmed.slice(0, colon).includes(" ")) {
    return trimmed.slice(colon + 1).trim();
  }
  return trimmed;
}

function stripFilePrefix(name: string): string {
  return name.replace(/^(?:File|Image):/i, "").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hasVariationsTemplate(wikitext: string): boolean {
  return /\{\{\s*Variations\b/i.test(wikitext);
}
