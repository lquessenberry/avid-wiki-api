/** Package version. Keep in sync with package.json. */
declare const VERSION = "0.1.0";

/** Error thrown when an AVID request fails or the API returns an error code. */
declare class AvidError extends Error {
    readonly code: string;
    readonly status: number | null;
    constructor(message: string, options?: {
        code?: string;
        status?: number | null;
        cause?: unknown;
    });
}

/** Store used by {@link AvidWikiClient} to skip repeat GET-equivalent POSTs. */
interface AvidCache {
    get(key: string): string | undefined | Promise<string | undefined>;
    set(key: string, value: string, ttlMs: number): void | Promise<void>;
}
/** In-memory response cache. Keys are the full API parameter set. */
declare class MemoryCache implements AvidCache {
    private readonly defaultTtlMs;
    private readonly store;
    constructor(defaultTtlMs?: number);
    get(key: string): string | undefined;
    set(key: string, value: string, ttlMs?: number): void;
    delete(key: string): void;
    clear(): void;
    get size(): number;
}

/** MediaWiki Action API for the Audiovisual Identity Database. */
declare const AVID_API_URL = "https://www.avid.wiki/w/api.php";
/** Public site origin. Article paths are `/${title}`. */
declare const AVID_SITE_URL = "https://www.avid.wiki";
declare const AVID_SITE_NAME = "Audiovisual Identity Database";
/**
 * Default User-Agent / Api-User-Agent. Override this with contact info
 * if you send a lot of traffic.
 */
declare const DEFAULT_USER_AGENT = "avid-wiki-api/0.1.0 (https://github.com/lquessenberry/avid-wiki-api)";
/** License that covers AVID article text. Individual files can differ. */
declare const CC_BY_SA_4_0: {
    readonly name: "Creative Commons Attribution-ShareAlike 4.0 International";
    readonly shortName: "CC BY-SA 4.0";
    readonly url: "https://creativecommons.org/licenses/by-sa/4.0/";
};
interface LicenseInfo {
    name: string;
    shortName: string;
    url: string;
}
interface Attribution {
    siteName: string;
    siteUrl: string;
    title: string;
    /** Page the returned prose and logo structure were read from. */
    sourceUrl: string;
    license: LicenseInfo;
    /**
     * Short reminder of the CC BY-SA 4.0 duties. Attaching this object to a
     * response does not by itself satisfy those duties if you republish the content.
     */
    requirements: string;
}
declare const ATTRIBUTION_REQUIREMENTS: string;
/** Build a canonical article URL. Spaces become underscores. */
declare function pageUrl(title: string, siteUrl?: string): string;
declare function attributionFor(title: string, siteUrl?: string): Attribution;
/** MediaWiki file title such as `File:Sega 1990.jpeg`. */
declare function fileTitle(name: string): string;
declare function filePageUrl(name: string, siteUrl?: string): string;

/** How precise a parsed endpoint is. Missing smaller units are unknown, not zero. */
type DatePrecision = "year" | "month" | "day";
interface DateEndpoint {
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
type DateRangeKind = "instant" | "range" | "open-ended" | "unknown";
/**
 * One span from a logo heading. A heading can carry several of these
 * (`1988-2002` and `2017-2019` on Sega's 4th logo).
 */
interface DateRange {
    /** Text of this span after `{{date}}` expansion, before it was interpreted. */
    raw: string;
    start: DateEndpoint | null;
    /** Null when the heading leaves the end open (`2017-`). */
    end: DateEndpoint | null;
    openStart: boolean;
    openEnd: boolean;
    kind: DateRangeKind;
}
interface LogoImage {
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
interface LogoVideo {
    provider: "youtube";
    id: string;
    url: string;
}
interface LogoSubsection {
    /** Normalized key such as `visuals`, `variants`, `audio`, `availability`. */
    key: string;
    /** Label as written, without the trailing colon. */
    title: string;
    text: string;
}
/** Grouped subsection text. `description` is the wiki's Visuals section. */
interface LogoText {
    description: string | null;
    variants: string | null;
    technique: string | null;
    audio: string | null;
    availability: string | null;
    trivia: string | null;
}
interface LogoEra {
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
interface CategoryRef {
    /** Category title without the `Category:` prefix, spaces not underscores. */
    title: string;
    hidden: boolean;
}
interface CompanyInfobox {
    name: string | null;
    founded: string | null;
    country: string | null;
    parent: string | null;
    formerly: string[];
    image: string | null;
}
interface CompanyLogos {
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
interface WikiSection {
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
interface WikiPage {
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
interface SearchResult {
    title: string;
    pageId: number;
    url: string;
    snippet: string;
    snippetText: string;
    wordCount: number;
    size: number;
    timestamp: string;
}
interface SearchPage {
    results: SearchResult[];
    /** Pass back as `offset` to read the next page. Null when this is the last page. */
    offset: number | null;
}
interface CategoryMember {
    title: string;
    pageId: number;
    namespace: number;
    url: string;
}
interface CategoryMembersPage {
    members: CategoryMember[];
    /** MediaWiki `cmcontinue` token. Null when this is the last page. */
    continue: string | null;
}
interface CompanyRef {
    title: string;
    pageId: number;
    url: string;
}
interface CompanyListPage {
    companies: CompanyRef[];
    continue: string | null;
}
interface ResolvedTitle {
    from: string;
    to: string;
    pageId: number | null;
    url: string;
    redirected: boolean;
}
interface FileInfo extends LogoImage {
    repository: string | null;
}
interface LogoGameMatch {
    logo: LogoEra;
    /** `title` when a parsed game title matched; `text` when only the section body did. */
    match: "title" | "text";
}

interface AvidClientOptions {
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
interface GetPageOptions {
    /** Include rendered HTML. Default true. It can be large on logo articles. */
    html?: boolean;
    /** Follow redirects. Default true. */
    redirects?: boolean;
}
interface GetCompanyOptions {
    /** Follow `{{/Production Logos}}` when the article itself has no logo headings. Default true. */
    followSubpages?: boolean;
    /** Resolve file URLs for every image on the parsed logos. Default false. */
    resolveImages?: boolean;
    /** Ask MediaWiki for a thumbnail at this width when resolving images. */
    thumbWidth?: number;
}
interface SearchOptions {
    limit?: number;
    offset?: number;
    /** MediaWiki namespace numbers. Default 0 (articles). */
    namespace?: number | number[];
}
interface ListCategoryOptions {
    limit?: number;
    /** `cmcontinue` token from a previous page. */
    continue?: string;
    namespace?: number | number[];
    type?: "page" | "subcat" | "file";
}
interface ListCompaniesOptions {
    limit?: number;
    continue?: string;
    /** Drop titles that contain `/`. Default true. */
    excludeSubpages?: boolean;
}
interface FileInfoOptions {
    thumbWidth?: number;
}
type QueryValue = string | number | boolean | undefined;
/**
 * Polite client for the Audiovisual Identity Database Action API.
 * Reads only. It never edits the wiki.
 */
declare class AvidWikiClient {
    readonly apiUrl: string;
    readonly siteUrl: string;
    readonly userAgent: string;
    private readonly maxlag;
    private readonly retries;
    private readonly retryBaseDelayMs;
    private readonly cache;
    private readonly cacheTtlMs;
    private readonly fetchImpl;
    private readonly origin;
    private readonly gate;
    constructor(options?: AvidClientOptions);
    /** Low-level Action API call. Parameters are sent as an encoded POST body. */
    request<T = unknown>(params: Record<string, QueryValue>): Promise<T>;
    /** Full-text search (`list=search`). */
    searchPages(query: string, options?: SearchOptions): Promise<SearchPage>;
    /**
     * One article: wikitext, HTML, table of contents, categories, and image file names.
     * Redirects are followed unless `redirects` is false.
     */
    getPage(title: string, options?: GetPageOptions): Promise<WikiPage>;
    /** One page of `list=categorymembers`, including the continuation token. */
    listCategoryMembers(category: string, options?: ListCategoryOptions): Promise<CategoryMembersPage>;
    /** Every member of a category. Each page waits on the client's throttle. */
    iterateCategoryMembers(category: string, options?: Omit<ListCategoryOptions, "continue">): AsyncGenerator<CategoryMember>;
    /**
     * Companies filed under Category:Video game logos.
     * This is the wiki's category, so it can include a few pages that are not studios.
     * Results come one API page at a time; pass `continue` for the next page.
     */
    listVideoGameLogoCompanies(options?: ListCompaniesOptions): Promise<CompanyListPage>;
    /** Resolve titles, following redirects. Missing pages come back with `pageId: null`. */
    resolveRedirects(titles: string[]): Promise<ResolvedTitle[]>;
    /** Image and file metadata, including original URLs. Titles may be file names or `File:` titles. */
    getFileInfo(files: string | string[], options?: FileInfoOptions): Promise<FileInfo[]>;
    /**
     * Structured logo eras for a company page.
     * Sega-style articles are parsed directly. Nintendo-style articles that only
     * transclude `{{/Production Logos}}` follow that subpage.
     */
    getCompany(title: string, options?: GetCompanyOptions): Promise<CompanyLogos>;
    private parsePage;
    private attachImageInfo;
    private buildParams;
    private fetchWithRetry;
    private delayFor;
}
declare function createAvidClient(options?: AvidClientOptions): AvidWikiClient;

interface DateWindow {
    start: number;
    end: number;
}
/**
 * Logos whose heading date range overlaps `date`.
 * Open-ended eras (a trailing hyphen) match every later date, so a long-running
 * "still variants" logo is returned together with the era that was current then.
 */
declare function findLogosCoveringDate(source: CompanyLogos | LogoEra[], date: string | Date): LogoEra[];
/**
 * Logos tied to a game. Title matches come from custom-variant headings.
 * Text matches search the description, variants, and availability sections.
 */
declare function findLogosByGame(source: CompanyLogos | LogoEra[], query: string, options?: {
    searchText?: boolean;
}): LogoGameMatch[];

/**
 * Expand AVID's `{{date}}` template the way the wiki renders it, without the
 * per-year search superscripts that template adds for editors.
 */
declare function expandDateTemplates(wikitext: string): string;
/**
 * Parse the date parenthetical of a logo heading into one or more ranges.
 * The input should already have `{{date}}` templates expanded.
 */
declare function parseDateRanges(input: string): DateRange[];

interface ParsedHeading {
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
/** Parse a logo-era heading. Returns null when the line is not an `Nth Logo` heading. */
declare function parseLogoHeading(rawHeading: string): ParsedHeading | null;

interface SectionAnchor {
    line: string;
    anchor: string;
}
interface ParseCompanyOptions {
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
/** Parse a company or production-logos article into collector-oriented logo eras. */
declare function parseCompanyWikitext(wikitext: string, options?: ParseCompanyOptions): CompanyLogos;
/** Normalize parse-API category records into titles with spaces. */
declare function mapApiCategories(categories: unknown): CategoryRef[];

export { ATTRIBUTION_REQUIREMENTS, AVID_API_URL, AVID_SITE_NAME, AVID_SITE_URL, type Attribution, type AvidCache, type AvidClientOptions, AvidError, AvidWikiClient, CC_BY_SA_4_0, type CategoryMember, type CategoryMembersPage, type CategoryRef, type CompanyInfobox, type CompanyListPage, type CompanyLogos, type CompanyRef, DEFAULT_USER_AGENT, type DateEndpoint, type DatePrecision, type DateRange, type DateRangeKind, type DateWindow, type FileInfo, type FileInfoOptions, type GetCompanyOptions, type GetPageOptions, type LicenseInfo, type ListCategoryOptions, type ListCompaniesOptions, type LogoEra, type LogoGameMatch, type LogoImage, type LogoSubsection, type LogoText, type LogoVideo, MemoryCache, type ParseCompanyOptions, type ResolvedTitle, type SearchOptions, type SearchPage, type SearchResult, VERSION, type WikiPage, type WikiSection, attributionFor, createAvidClient, expandDateTemplates, filePageUrl, fileTitle, findLogosByGame, findLogosCoveringDate, mapApiCategories, pageUrl, parseCompanyWikitext, parseDateRanges, parseLogoHeading };
