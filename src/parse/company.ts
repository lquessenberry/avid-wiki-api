import { attributionFor, AVID_SITE_URL } from "../attribution.js";
import type {
  CategoryRef,
  CompanyInfobox,
  CompanyLogos,
  LogoEra,
  LogoImage,
} from "../types.js";
import { anchorFromHeading, parseLogoHeading } from "./heading.js";
import {
  cleanInline,
  extractImages,
  extractLinkedSubpages,
  extractTemplate,
  extractVideos,
  groupLogoText,
  hasVariationsTemplate,
  parseImageToc,
  parseInfoboxFields,
  productionLogosSubpage,
  removeBalancedTemplate,
  splitBreaks,
  subsectionsFromBody,
  toLogoImage,
  wikitextToPlain,
} from "./wikitext.js";

export interface SectionAnchor {
  line: string;
  anchor: string;
}

export interface ParseCompanyOptions {
  title?: string;
  pageId?: number | null;
  url?: string;
  contentTitle?: string;
  categories?: CategoryRef[];
  siteUrl?: string;
  retrievedAt?: string;
  sections?: SectionAnchor[];
  sources?: string[];
}

interface WikiHeading {
  level: number;
  heading: string;
  body: string;
}

/** Parse a company or production-logos article into collector-oriented logo eras. */
export function parseCompanyWikitext(wikitext: string, options: ParseCompanyOptions = {}): CompanyLogos {
  const siteUrl = options.siteUrl ?? AVID_SITE_URL;
  const title = options.title ?? "Unknown";
  const { intro, sections } = splitWikiSections(wikitext);
  const infobox = readInfobox(intro);
  const description = readDescription(intro);
  const linkedSubpages = extractLinkedSubpages(wikitext);
  const toc = parseImageToc(wikitext);
  const anchors = anchorsByOrdinal(options.sections ?? []);
  const warnings: string[] = [];
  if (hasVariationsTemplate(wikitext)) {
    warnings.push(
      "This page transcludes {{Variations}} subpages. That extra variation text is not expanded.",
    );
  }

  const logos: LogoEra[] = [];
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
      videos: extractVideos(section.body),
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
    retrievedAt: options.retrievedAt ?? new Date().toISOString(),
  };
}

export function categoriesFromWikitext(wikitext: string): CategoryRef[] {
  const categories: CategoryRef[] = [];
  const seen = new Set<string>();
  for (const match of wikitext.matchAll(/\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi)) {
    const title = (match[1] ?? "").replace(/_/g, " ").trim();
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    categories.push({ title, hidden: false });
  }
  return categories;
}

/** Normalize parse-API category records into titles with spaces. */
export function mapApiCategories(categories: unknown): CategoryRef[] {
  if (!Array.isArray(categories)) return [];
  const out: CategoryRef[] = [];
  for (const category of categories) {
    if (typeof category === "string") {
      out.push({ title: category.replace(/_/g, " ").replace(/^Category:/i, ""), hidden: false });
      continue;
    }
    if (!category || typeof category !== "object") continue;
    const record = category as Record<string, unknown>;
    const raw = record.category ?? record["*"] ?? record.title;
    if (typeof raw !== "string") continue;
    out.push({
      title: raw.replace(/_/g, " ").replace(/^Category:/i, ""),
      hidden: Boolean(record.hidden),
    });
  }
  return out;
}

export function splitWikiSections(wikitext: string): { intro: string; sections: WikiHeading[] } {
  // Headings may contain "=" inside {{date|year=1983}}. Match a balanced marker
  // instead of stopping at the first equals sign.
  const re = /^(={2,6})\s*(.*?)\s*\1[ \t]*$/gm;
  const matches = [...wikitext.matchAll(re)];
  if (matches.length === 0) return { intro: wikitext, sections: [] };
  const intro = wikitext.slice(0, matches[0]?.index ?? 0);
  const sections: WikiHeading[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    if (!match) continue;
    const bodyStart = (match.index ?? 0) + match[0].length;
    const next = matches[i + 1];
    const bodyEnd = next ? (next.index ?? wikitext.length) : wikitext.length;
    sections.push({
      level: (match[1] ?? "").length,
      heading: (match[2] ?? "").trim(),
      body: wikitext.slice(bodyStart, bodyEnd),
    });
  }
  return { intro, sections };
}

function readInfobox(intro: string): CompanyInfobox | null {
  const template = extractTemplate(intro, "Infobox company");
  if (!template) return null;
  const fields = parseInfoboxFields(template);
  return {
    name: fields.name ? cleanInline(fields.name) : null,
    founded: fields.founded ? cleanInline(fields.founded) : null,
    country: fields.country ? cleanInline(fields.country) : null,
    parent: fields.parent ? cleanInline(fields.parent) : null,
    formerly: fields.formerly ? splitBreaks(fields.formerly) : [],
    image: fields.image ? fields.image.replace(/^File:/i, "").trim() : null,
  };
}

function readDescription(intro: string): string | null {
  let text = intro;
  text = removeBalancedTemplate(text, "Infobox company");
  const plain = wikitextToPlain(text);
  const paragraph = plain
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .find((part) => part.length > 40);
  return paragraph ?? null;
}

function firstBold(intro: string): string | null {
  const match = /'''([^'\n]+)'''/.exec(intro);
  return match?.[1]?.trim() ?? null;
}

function ordinalOf(label: string): number | null {
  const match = /^\s*(\d+)(?:st|nd|rd|th)\b/i.exec(label);
  return match ? Number(match[1]) : null;
}

function anchorsByOrdinal(sections: SectionAnchor[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
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

function placePrimaryImage(images: LogoImage[], file: string | undefined, siteUrl: string): LogoImage | null {
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

export { productionLogosSubpage };
