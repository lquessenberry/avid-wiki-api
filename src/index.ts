export { VERSION } from "./version.js";
export { AvidError } from "./errors.js";
export { MemoryCache } from "./cache.js";
export type { AvidCache } from "./cache.js";

export {
  ATTRIBUTION_REQUIREMENTS,
  AVID_API_URL,
  AVID_SITE_NAME,
  AVID_SITE_URL,
  CC_BY_SA_4_0,
  DEFAULT_USER_AGENT,
  attributionFor,
  filePageUrl,
  fileTitle,
  pageUrl,
} from "./attribution.js";
export type { Attribution, LicenseInfo } from "./attribution.js";

export { AvidWikiClient, createAvidClient } from "./client.js";
export type {
  AvidClientOptions,
  FileInfoOptions,
  GetCompanyOptions,
  GetPageOptions,
  ListCategoryOptions,
  ListCompaniesOptions,
  SearchOptions,
} from "./client.js";

export { findLogosByGame, findLogosCoveringDate } from "./collectors.js";
export type { DateWindow } from "./collectors.js";

export { expandDateTemplates, parseDateRanges } from "./parse/dates.js";
export { parseLogoHeading } from "./parse/heading.js";
export { mapApiCategories, parseCompanyWikitext } from "./parse/company.js";
export type { ParseCompanyOptions } from "./parse/company.js";

export type {
  CategoryMember,
  CategoryMembersPage,
  CategoryRef,
  CompanyInfobox,
  CompanyListPage,
  CompanyLogos,
  CompanyRef,
  DateEndpoint,
  DatePrecision,
  DateRange,
  DateRangeKind,
  FileInfo,
  LogoEra,
  LogoGameMatch,
  LogoImage,
  LogoSubsection,
  LogoText,
  LogoVideo,
  ResolvedTitle,
  SearchPage,
  SearchResult,
  WikiPage,
  WikiSection,
} from "./types.js";
