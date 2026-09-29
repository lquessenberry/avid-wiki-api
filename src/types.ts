import type { Attribution, LicenseInfo } from "./attribution.js";

export type { Attribution, LicenseInfo };

/** How precise a parsed endpoint is. Missing smaller units are unknown, not zero. */
export type DatePrecision = "year" | "month" | "day";

export interface DateEndpoint {
  year: number;
  /** 1-12, or null when the wiki only gives a year. */
  month: number | null;
  /** 1-31, or null when the wiki only gives a month or year. */
  day: number | null;
  precision: DatePrecision;
  /** True when the wiki marks the value with `?`. */
  uncertain: boolean;
  /** Partial ISO-8601: `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. */
  iso: string;
}

export type DateRangeKind = "instant" | "range" | "open-ended" | "unknown";

/**
 * One span from a logo heading. A heading can carry several of these
 * (`1988-2002` and `2017-2019` on Sega's 4th logo).
 */
export interface DateRange {
  /** Text of this span after `{{date}}` expansion, before it was interpreted. */
  raw: string;
  start: DateEndpoint | null;
  /** Null when the heading leaves the end open (`2017-`). */
  end: DateEndpoint | null;
  openStart: boolean;
  openEnd: boolean;
  kind: DateRangeKind;
}

export interface LogoImage {
  /** Filename as written on the wiki page. */
  name: string;
  /** `File:…` title with underscores normalized to spaces. */
  title: string;
  /** File description page on avid.wiki. */
  pageUrl: string;
  /** Direct file URL. Present after image info is resolved. */
  url?: string | null;
  descriptionUrl?: string | null;
  mime?: string | null;
  mediatype?: string | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  thumbUrl?: string | null;
  /** License of this file, which may differ from the article's CC BY-SA license. */
  licenseShortName?: string | null;
  usageTerms?: string | null;
  artist?: string | null;
  credit?: string | null;
  missing?: boolean;
}

export interface LogoVideo {
  provider: "youtube";
  id: string;
  url: string;
}

export interface LogoSubsection {
  /** Normalized key such as `visuals`, `variants`, `audio`, `availability`. */
  key: string;
  /** Label as written, without the trailing colon. */
  title: string;
  text: string;
}

/** Grouped subsection text. `description` is the wiki's Visuals section. */
export interface LogoText {
  description: string | null;
  variants: string | null;
  technique: string | null;
  audio: string | null;
  availability: string | null;
  trivia: string | null;
}

export interface LogoEra {
  /** Zero-based order on the page. */
  index: number;
  /** Numeric prefix of `4th Logo`. */
  ordinal: number;
  /** `4th`, `1st`, and so on, as written. */
  ordinalLabel: string;
  /** Heading with templates expanded and markup removed. */
  heading: string;
  /** Heading markup as stored in wikitext. */
  rawHeading: string;
  /** TOC anchor when the client had `tocdata`; otherwise a best-effort slug. */
  anchor: string;
  /**
   * Parenthetical name that is not the date, such as `Still variants`,
   * `Amazing Sega`, or `Ecco series custom variant`.
   */
  label: string | null;
  /** True when the heading says `custom variant`. */
  isCustomVariant: boolean;
  /**
   * Primary game title for a custom variant.
   * Trailing `series` / `prototype(s)` qualifiers are removed.
   */
  gameTitle: string | null;
  /** Every title, including names separated by ` / `. */
  gameTitles: string[];
  /** Qualifiers stripped from the game title (`series`, `prototype`, `prototypes`). */
  qualifiers: string[];
  /** Date parenthetical, templates already expanded. */
  dateText: string | null;
  dateRanges: DateRange[];
  subsections: LogoSubsection[];
  text: LogoText;
  images: LogoImage[];
  /** Representative still, from `{{ImageTOC}}` when the page has one. */
  primaryImage: LogoImage | null;
  videos: LogoVideo[];
}

export interface CategoryRef {
  /** Category title without the `Category:` prefix, spaces not underscores. */
  title: string;
  hidden: boolean;
}

export interface CompanyInfobox {
  name: string | null;
  founded: string | null;
  country: string | null;
  parent: string | null;
  formerly: string[];
  image: string | null;
}

export interface CompanyLogos {
  /** Article title the caller asked for, after redirects. */
  title: string;
  companyName: string;
  pageId: number | null;
  /** Company article, even when logos live on a subpage. */
  url: string;
  /** Page whose wikitext was parsed into `logos`. */
  contentUrl: string;
  description: string | null;
  infobox: CompanyInfobox | null;
  /** Company mark from the infobox, when present. */
  companyLogo: LogoImage | null;
  logos: LogoEra[];
  categories: CategoryRef[];
  /** Subpage transclusions such as `/Production Logos`. */
  linkedSubpages: string[];
  /** Page titles that were read. */
  sources: string[];
  /** Notes about content the parser did not expand or dates it could not read. */
  warnings: string[];
  attribution: Attribution;
  retrievedAt: string;
}

export interface WikiSection {
  index: number;
  tocLevel: number;
  level: number;
  /** Heading HTML from the API, including date-template superscripts. */
  line: string;
  /** Heading with tags removed. */
  text: string;
  number: string;
  anchor: string;
}

export interface WikiPage {
  title: string;
  pageId: number;
  url: string;
  wikitext: string;
  /** Rendered HTML, when requested. */
  html: string | null;
  sections: WikiSection[];
  categories: CategoryRef[];
  /** File names as returned by the parse API (often underscored). */
  images: string[];
  revisionId: number | null;
  redirectedFrom: string | null;
  displayTitle: string;
  attribution: Attribution;
}

export interface SearchResult {
  title: string;
  pageId: number;
  url: string;
  snippet: string;
  snippetText: string;
  wordCount: number;
  size: number;
  timestamp: string;
}

export interface SearchPage {
  results: SearchResult[];
  /** Pass back as `offset` to read the next page. Null when this is the last page. */
  offset: number | null;
}

export interface CategoryMember {
  title: string;
  pageId: number;
  namespace: number;
  url: string;
}

export interface CategoryMembersPage {
  members: CategoryMember[];
  /** MediaWiki `cmcontinue` token. Null when this is the last page. */
  continue: string | null;
}

export interface CompanyRef {
  title: string;
  pageId: number;
  url: string;
}

export interface CompanyListPage {
  companies: CompanyRef[];
  continue: string | null;
}

export interface ResolvedTitle {
  from: string;
  to: string;
  pageId: number | null;
  url: string;
  redirected: boolean;
}

export interface FileInfo extends LogoImage {
  repository: string | null;
}

export interface LogoGameMatch {
  logo: LogoEra;
  /** `title` when a parsed game title matched; `text` when only the section body did. */
  match: "title" | "text";
}
