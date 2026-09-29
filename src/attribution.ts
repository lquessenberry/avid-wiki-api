import { VERSION } from "./version.js";

/** MediaWiki Action API for the Audiovisual Identity Database. */
export const AVID_API_URL = "https://www.avid.wiki/w/api.php";

/** Public site origin. Article paths are `/${title}`. */
export const AVID_SITE_URL = "https://www.avid.wiki";

export const AVID_SITE_NAME = "Audiovisual Identity Database";

/**
 * Default User-Agent / Api-User-Agent. Override this with contact info
 * if you send a lot of traffic.
 */
export const DEFAULT_USER_AGENT = `avid-wiki-api/${VERSION} (https://github.com/lquessenberry/avid-wiki-api)`;

/** License that covers AVID article text. Individual files can differ. */
export const CC_BY_SA_4_0 = {
  name: "Creative Commons Attribution-ShareAlike 4.0 International",
  shortName: "CC BY-SA 4.0",
  url: "https://creativecommons.org/licenses/by-sa/4.0/",
} as const;

export interface LicenseInfo {
  name: string;
  shortName: string;
  url: string;
}

export interface Attribution {
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

export const ATTRIBUTION_REQUIREMENTS =
  "Content from the Audiovisual Identity Database is licensed under CC BY-SA 4.0. " +
  "Credit the wiki, link the source page and the license, and distribute adaptations under the same license. " +
  "Image files can carry a different license; check each file before republishing it.";

/** Build a canonical article URL. Spaces become underscores. */
export function pageUrl(title: string, siteUrl: string = AVID_SITE_URL): string {
  const base = siteUrl.replace(/\/$/, "");
  const slug = title.trim().replace(/ /g, "_");
  const encoded = encodeURIComponent(slug)
    .replace(/%2F/g, "/")
    .replace(/%3A/g, ":")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")");
  return `${base}/${encoded}`;
}

export function attributionFor(title: string, siteUrl: string = AVID_SITE_URL): Attribution {
  return {
    siteName: AVID_SITE_NAME,
    siteUrl: siteUrl.replace(/\/$/, "") + "/",
    title,
    sourceUrl: pageUrl(title, siteUrl),
    license: CC_BY_SA_4_0,
    requirements: ATTRIBUTION_REQUIREMENTS,
  };
}

/** MediaWiki file title such as `File:Sega 1990.jpeg`. */
export function fileTitle(name: string): string {
  const trimmed = name.trim().replace(/^File:/i, "").replace(/^Image:/i, "").trim();
  const spaced = trimmed.replace(/_/g, " ").replace(/\s+/g, " ");
  return `File:${spaced}`;
}

export function filePageUrl(name: string, siteUrl: string = AVID_SITE_URL): string {
  return pageUrl(fileTitle(name), siteUrl);
}
