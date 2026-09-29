import {
  AVID_API_URL,
  AVID_SITE_URL,
  attributionFor,
  DEFAULT_USER_AGENT,
  fileTitle,
  pageUrl,
} from "./attribution.js";
import type { AvidCache } from "./cache.js";
import { MemoryCache } from "./cache.js";
import { AvidError } from "./errors.js";
import { sleep, RequestGate } from "./limit.js";
import {
  categoriesFromWikitext,
  mapApiCategories,
  parseCompanyWikitext,
  productionLogosSubpage,
} from "./parse/company.js";
import { fileKey, stripHtml } from "./parse/wikitext.js";
import type {
  CategoryMember,
  CategoryMembersPage,
  CompanyListPage,
  CompanyLogos,
  FileInfo,
  ResolvedTitle,
  SearchPage,
  SearchResult,
  WikiPage,
  WikiSection,
} from "./types.js";

export interface AvidClientOptions {
  /** MediaWiki API endpoint. Default: `https://www.avid.wiki/w/api.php`. */
  apiUrl?: string;
  /** Site origin used for article URLs. Default: `https://www.avid.wiki`. */
  siteUrl?: string;
  /**
   * Descriptive User-Agent and Api-User-Agent. Browsers cannot set User-Agent;
   * Api-User-Agent is sent there instead.
   */
  userAgent?: string;
  /** Sent as `maxlag`. Default 5. Use 0 to omit it. */
  maxlag?: number;
  /** Minimum milliseconds between request starts. Default 250. */
  minIntervalMs?: number;
  /** How many requests may run at once. Default 2. */
  maxConcurrency?: number;
  /** Extra attempts after the first failure. Default 3. */
  retries?: number;
  /** Base backoff in milliseconds, doubled each attempt. Default 400. */
  retryBaseDelayMs?: number;
  /** `true` for an in-memory cache, or your own store. Default off. */
  cache?: boolean | AvidCache;
  /** TTL when `cache: true`. Default 5 minutes. */
  cacheTtlMs?: number;
  /** `fetch` implementation. Defaults to the global one. */
  fetch?: typeof fetch;
  /**
   * MediaWiki CORS `origin` parameter. Default `*` so browser calls succeed.
   * Pass `false` to omit it.
   */
  origin?: string | false;
}

export interface GetPageOptions {
  /** Include rendered HTML. Default true. It can be large on logo articles. */
  html?: boolean;
  /** Follow redirects. Default true. */
  redirects?: boolean;
}

export interface GetCompanyOptions {
  /** Follow `{{/Production Logos}}` when the article itself has no logo headings. Default true. */
  followSubpages?: boolean;
  /** Resolve file URLs for every image on the parsed logos. Default false. */
  resolveImages?: boolean;
  /** Ask MediaWiki for a thumbnail at this width when resolving images. */
  thumbWidth?: number;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  /** MediaWiki namespace numbers. Default 0 (articles). */
  namespace?: number | number[];
}

export interface ListCategoryOptions {
  limit?: number;
  /** `cmcontinue` token from a previous page. */
  continue?: string;
  namespace?: number | number[];
  type?: "page" | "subcat" | "file";
}

export interface ListCompaniesOptions {
  limit?: number;
  continue?: string;
  /** Drop titles that contain `/`. Default true. */
  excludeSubpages?: boolean;
}

export interface FileInfoOptions {
  thumbWidth?: number;
}

type QueryValue = string | number | boolean | undefined;

interface RawError {
  code?: string;
  info?: string;
}

interface RawTocSection {
  tocLevel?: number;
  hLevel?: number;
  level?: string | number;
  line?: string;
  number?: string;
  index?: string | number;
  anchor?: string;
}

interface RawParse {
  title?: string;
  pageid?: number;
  wikitext?: string | { "*"?: string };
  text?: string | { "*"?: string };
  images?: unknown;
  categories?: unknown;
  displaytitle?: string;
  revid?: number;
  redirects?: Array<{ from?: string; to?: string }>;
  tocdata?: { sections?: RawTocSection[] };
  sections?: RawTocSection[];
}

/**
 * Polite client for the Audiovisual Identity Database Action API.
 * Reads only. It never edits the wiki.
 */
export class AvidWikiClient {
  readonly apiUrl: string;
  readonly siteUrl: string;
  readonly userAgent: string;
  private readonly maxlag: number;
  private readonly retries: number;
  private readonly retryBaseDelayMs: number;
  private readonly cache: AvidCache | null;
  private readonly cacheTtlMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly origin: string | false;
  private readonly gate: RequestGate;

  constructor(options: AvidClientOptions = {}) {
    this.apiUrl = options.apiUrl ?? AVID_API_URL;
    this.siteUrl = (options.siteUrl ?? AVID_SITE_URL).replace(/\/$/, "");
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.maxlag = options.maxlag ?? 5;
    this.retries = options.retries ?? 3;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? 400;
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1000;
    this.cache =
      options.cache === true ? new MemoryCache(this.cacheTtlMs) : options.cache ? options.cache : null;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.origin = options.origin === false ? false : (options.origin ?? "*");
    this.gate = new RequestGate(options.maxConcurrency ?? 2, options.minIntervalMs ?? 250);
  }

  /** Low-level Action API call. Parameters are sent as an encoded POST body. */
  async request<T = unknown>(params: Record<string, QueryValue>): Promise<T> {
    const query = this.buildParams(params);
    const key = stableKey(query);
    if (this.cache) {
      const hit = await this.cache.get(key);
      if (hit !== undefined) return JSON.parse(hit) as T;
    }
    const text = await this.gate.run(() => this.fetchWithRetry(query));
    if (this.cache) await this.cache.set(key, text, this.cacheTtlMs);
    return JSON.parse(text) as T;
  }

  /** Full-text search (`list=search`). */
  async searchPages(query: string, options: SearchOptions = {}): Promise<SearchPage> {
    const data = await this.request<QueryListResponse>({
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: clampLimit(options.limit, 10, 50),
      sroffset: options.offset,
      srnamespace: joinNs(options.namespace ?? 0),
      srprop: "snippet|size|wordcount|timestamp",
    });
    const results: SearchResult[] = (data.query?.search ?? []).map((hit) => ({
      title: hit.title,
      pageId: hit.pageid,
      url: pageUrl(hit.title, this.siteUrl),
      snippet: hit.snippet ?? "",
      snippetText: stripHtml(hit.snippet ?? "").replace(/\s+/g, " ").trim(),
      wordCount: hit.wordcount ?? 0,
      size: hit.size ?? 0,
      timestamp: hit.timestamp ?? "",
    }));
    const offset = typeof data.continue?.sroffset === "number" ? data.continue.sroffset : null;
    return { results, offset };
  }

  /**
   * One article: wikitext, HTML, table of contents, categories, and image file names.
   * Redirects are followed unless `redirects` is false.
   */
  async getPage(title: string, options: GetPageOptions = {}): Promise<WikiPage> {
    const wantHtml = options.html !== false;
    const props = ["wikitext", "categories", "images", "tocdata", "displaytitle", "revid"];
    if (wantHtml) props.push("text");
    const data = await this.request<{ parse?: RawParse; error?: RawError }>({
      action: "parse",
      page: title,
      prop: props.join("|"),
      redirects: options.redirects === false ? undefined : 1,
    });
    const parse = data.parse;
    if (!parse?.title || parse.pageid === undefined) {
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
      attribution: attributionFor(resolved, this.siteUrl),
    };
  }

  /** One page of `list=categorymembers`, including the continuation token. */
  async listCategoryMembers(category: string, options: ListCategoryOptions = {}): Promise<CategoryMembersPage> {
    const title = /^category:/i.test(category) ? category : `Category:${category}`;
    const data = await this.request<QueryListResponse>({
      action: "query",
      list: "categorymembers",
      cmtitle: title,
      cmlimit: clampLimit(options.limit, 50, 500),
      cmcontinue: options.continue,
      cmnamespace: options.namespace === undefined ? undefined : joinNs(options.namespace),
      cmtype: options.type,
    });
    const members: CategoryMember[] = (data.query?.categorymembers ?? []).map((member) => ({
      title: member.title,
      pageId: member.pageid,
      namespace: member.ns,
      url: pageUrl(member.title, this.siteUrl),
    }));
    return { members, continue: data.continue?.cmcontinue ?? null };
  }

  /** Every member of a category. Each page waits on the client's throttle. */
  async *iterateCategoryMembers(
    category: string,
    options: Omit<ListCategoryOptions, "continue"> = {},
  ): AsyncGenerator<CategoryMember> {
    let token: string | undefined;
    do {
      const page = await this.listCategoryMembers(category, { ...options, continue: token });
      for (const member of page.members) yield member;
      token = page.continue ?? undefined;
    } while (token);
  }

  /**
   * Companies filed under Category:Video game logos.
   * This is the wiki's category, so it can include a few pages that are not studios.
   * Results come one API page at a time; pass `continue` for the next page.
   */
  async listVideoGameLogoCompanies(options: ListCompaniesOptions = {}): Promise<CompanyListPage> {
    const page = await this.listCategoryMembers("Category:Video game logos", {
      limit: options.limit ?? 50,
      continue: options.continue,
      namespace: 0,
      type: "page",
    });
    const exclude = options.excludeSubpages !== false;
    return {
      companies: page.members
        .filter((member) => (exclude ? !member.title.includes("/") : true))
        .map((member) => ({ title: member.title, pageId: member.pageId, url: member.url })),
      continue: page.continue,
    };
  }

  /** Resolve titles, following redirects. Missing pages come back with `pageId: null`. */
  async resolveRedirects(titles: string[]): Promise<ResolvedTitle[]> {
    if (titles.length === 0) return [];
    const data = await this.request<QueryPagesResponse>({
      action: "query",
      titles: titles.join("|"),
      redirects: 1,
      prop: "info",
      inprop: "url",
    });
    const redirects = new Map<string, string>();
    for (const redirect of data.query?.redirects ?? []) {
      if (redirect.from && redirect.to) redirects.set(redirect.from, redirect.to);
    }
    const normalized = new Map<string, string>();
    for (const item of data.query?.normalized ?? []) {
      if (item.from && item.to) normalized.set(item.from, item.to);
    }
    const byTitle = new Map<string, QueryPage>();
    for (const page of data.query?.pages ?? []) byTitle.set(page.title, page);

    return titles.map((from) => {
      let current = from;
      const seen = new Set<string>();
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
        redirected: from !== to,
      };
    });
  }

  /** Image and file metadata, including original URLs. Titles may be file names or `File:` titles. */
  async getFileInfo(files: string | string[], options: FileInfoOptions = {}): Promise<FileInfo[]> {
    const list = (Array.isArray(files) ? files : [files]).map((file) => fileTitle(file));
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const title of list) {
      const key = fileKey(title);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(title);
    }
    const pages: QueryPage[] = [];
    for (let i = 0; i < unique.length; i += 50) {
      const batch = unique.slice(i, i + 50);
      const data = await this.request<QueryPagesResponse>({
        action: "query",
        titles: batch.join("|"),
        prop: "imageinfo",
        iiprop: "url|size|mime|mediatype|extmetadata",
        iiurlwidth: options.thumbWidth,
      });
      pages.push(...(data.query?.pages ?? []));
    }
    const byKey = new Map<string, QueryPage>();
    for (const page of pages) byKey.set(fileKey(page.title), page);
    return unique.map((title) => toFileInfo(title, byKey.get(fileKey(title)), this.siteUrl));
  }

  /**
   * Structured logo eras for a company page.
   * Sega-style articles are parsed directly. Nintendo-style articles that only
   * transclude `{{/Production Logos}}` follow that subpage.
   */
  async getCompany(title: string, options: GetCompanyOptions = {}): Promise<CompanyLogos> {
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
          attribution: parsed.attribution,
        };
      }
    }
    if (options.resolveImages) {
      company = await this.attachImageInfo(company, options.thumbWidth);
    }
    return company;
  }

  private parsePage(page: WikiPage, title = page.title): CompanyLogos {
    const categories = page.categories.length > 0 ? page.categories : categoriesFromWikitext(page.wikitext);
    return parseCompanyWikitext(page.wikitext, {
      title,
      pageId: page.pageId,
      url: pageUrl(title, this.siteUrl),
      contentTitle: page.title,
      categories,
      siteUrl: this.siteUrl,
      sections: page.sections.map((section) => ({ line: section.line, anchor: section.anchor })),
      sources: [page.title],
    });
  }

  private async attachImageInfo(company: CompanyLogos, thumbWidth?: number): Promise<CompanyLogos> {
    const titles: string[] = [];
    if (company.companyLogo) titles.push(company.companyLogo.title);
    for (const logo of company.logos) {
      for (const image of logo.images) titles.push(image.title);
    }
    if (titles.length === 0) return company;
    const infos = await this.getFileInfo(titles, thumbWidth ? { thumbWidth } : {});
    const byKey = new Map(infos.map((info) => [fileKey(info.title), info]));
    const fill = <T extends { title: string } | null>(image: T): T | FileInfo => {
      if (!image) return image;
      return byKey.get(fileKey(image.title)) ?? image;
    };
    return {
      ...company,
      companyLogo: fill(company.companyLogo),
      logos: company.logos.map((logo) => {
        const images = logo.images.map((image) => byKey.get(fileKey(image.title)) ?? image);
        const primary = logo.primaryImage ? (byKey.get(fileKey(logo.primaryImage.title)) ?? logo.primaryImage) : null;
        return { ...logo, images, primaryImage: primary };
      }),
    };
  }

  private buildParams(params: Record<string, QueryValue>): Record<string, string> {
    const query: Record<string, string> = {
      format: "json",
      formatversion: "2",
    };
    if (this.maxlag > 0) query.maxlag = String(this.maxlag);
    if (this.origin !== false) query.origin = this.origin;
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "") continue;
      query[key] = typeof value === "boolean" ? (value ? "1" : "0") : String(value);
    }
    return query;
  }

  private async fetchWithRetry(query: Record<string, string>): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const response = await this.fetchImpl(this.apiUrl, {
          method: "POST",
          headers: identityHeaders(this.userAgent),
          body: new URLSearchParams(query),
        });
        const text = await response.text();
        const data = tryParse(text);
        const code = data?.error?.code;
        const retryable =
          attempt < this.retries &&
          (response.status === 429 || response.status >= 500 || code === "maxlag" || code === "ratelimited");
        if (retryable) {
          await sleep(this.delayFor(attempt, response));
          continue;
        }
        if (!response.ok || code) {
          throw new AvidError(data?.error?.info || response.statusText || "AVID API request failed", {
            code: code || `http-${response.status}`,
            status: response.status,
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
            cause: error,
          });
        }
        await sleep(this.delayFor(attempt));
      }
    }
    throw new AvidError(lastError instanceof Error ? lastError.message : "AVID API request failed", {
      code: "network",
      cause: lastError,
    });
  }

  private delayFor(attempt: number, response?: Response): number {
    const header = response?.headers.get("retry-after");
    if (header && /^\d+$/.test(header.trim())) {
      const seconds = Number(header.trim());
      if (this.retryBaseDelayMs === 0) return 0;
      return seconds * 1000;
    }
    if (this.retryBaseDelayMs === 0) return 0;
    return this.retryBaseDelayMs * 2 ** attempt;
  }
}

export function createAvidClient(options?: AvidClientOptions): AvidWikiClient {
  return new AvidWikiClient(options);
}

function identityHeaders(userAgent: string): Headers {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
  headers.set("Api-User-Agent", userAgent);
  try {
    headers.set("User-Agent", userAgent);
  } catch {
    // Browsers forbid setting User-Agent. Api-User-Agent still identifies the client.
  }
  return headers;
}

function stableKey(query: Record<string, string>): string {
  return Object.keys(query)
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join("&");
}

function tryParse(text: string): { error?: RawError } | null {
  try {
    return JSON.parse(text) as { error?: RawError };
  } catch {
    return null;
  }
}

function readStringField(value: string | { "*"?: string } | undefined): string {
  if (typeof value === "string") return value;
  if (value && typeof value["*"] === "string") return value["*"];
  return "";
}

function mapSections(parse: RawParse): WikiSection[] {
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
      anchor: section.anchor ?? "",
    };
  });
}

function mapImageNames(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  const names: string[] = [];
  for (const image of images) {
    if (typeof image === "string") names.push(image);
    else if (image && typeof image === "object" && "title" in image) {
      const title = (image as { title?: unknown }).title;
      if (typeof title === "string") names.push(title.replace(/^File:/i, ""));
    }
  }
  return names;
}

function clampLimit(value: number | undefined, fallback: number, max: number): number {
  const limit = value ?? fallback;
  if (!Number.isFinite(limit)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(limit)));
}

function joinNs(namespace: number | number[]): string {
  return (Array.isArray(namespace) ? namespace : [namespace]).join("|");
}

function mergeCategories(left: CompanyLogos["categories"], right: CompanyLogos["categories"]): CompanyLogos["categories"] {
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

function dedupeTitles(titles: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const title of titles) {
    if (seen.has(title)) continue;
    seen.add(title);
    out.push(title);
  }
  return out;
}

interface QueryListResponse {
  query?: {
    search?: Array<{
      title: string;
      pageid: number;
      snippet?: string;
      wordcount?: number;
      size?: number;
      timestamp?: string;
    }>;
    categorymembers?: Array<{ title: string; pageid: number; ns: number }>;
  };
  continue?: { sroffset?: number; cmcontinue?: string };
}

interface QueryPage {
  pageid: number;
  ns: number;
  title: string;
  missing?: boolean;
  imagerepository?: string;
  imageinfo?: Array<{
    url?: string;
    descriptionurl?: string;
    mime?: string;
    mediatype?: string;
    width?: number;
    height?: number;
    size?: number;
    thumburl?: string;
    extmetadata?: Record<string, { value?: string } | undefined>;
  }>;
}

interface QueryPagesResponse {
  query?: {
    pages?: QueryPage[];
    redirects?: Array<{ from?: string; to?: string }>;
    normalized?: Array<{ from?: string; to?: string }>;
  };
}

function toFileInfo(requested: string, page: QueryPage | undefined, siteUrl: string): FileInfo {
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
    repository: page?.imagerepository ?? null,
  };
}

function metaText(entry: { value?: string } | undefined): string | null {
  if (!entry?.value) return null;
  const text = stripHtml(entry.value).replace(/\s+/g, " ").trim();
  return text || null;
}
