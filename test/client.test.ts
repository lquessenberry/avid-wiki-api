import { describe, expect, it } from "vitest";
import { AvidError, AvidWikiClient, MemoryCache } from "../src/index.js";
import { loadFixture } from "./helpers.js";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function clientWith(handler: (params: URLSearchParams, init: RequestInit) => Response | Promise<Response>, extra: Record<string, unknown> = {}) {
  const calls: URLSearchParams[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const params = new URLSearchParams(String(init?.body ?? ""));
    calls.push(params);
    return handler(params, init ?? {});
  };
  const client = new AvidWikiClient({
    fetch: fetchImpl,
    minIntervalMs: 0,
    maxConcurrency: 2,
    retryBaseDelayMs: 0,
    retries: 2,
    userAgent: "avid-wiki-api-test/0.0",
    ...extra,
  });
  return { client, calls };
}

describe("AvidWikiClient", () => {
  it("sends a descriptive user agent, maxlag, and CORS origin", async () => {
    const sega = loadFixture("sega.parse.json");
    let headers = new Headers();
    const { client, calls } = clientWith((_params, init) => {
      headers = new Headers(init.headers);
      return jsonResponse(sega);
    });
    const page = await client.getPage("Sega", { html: false });
    expect(page.title).toBe("Sega");
    expect(page.sections).toHaveLength(15);
    expect(page.categories.some((category) => category.title === "Video game logos")).toBe(true);
    expect(page.wikitext).toContain("===1st Logo");
    expect(page.attribution.sourceUrl).toBe("https://www.avid.wiki/Sega");
    const params = calls[0];
    expect(params?.get("maxlag")).toBe("5");
    expect(params?.get("origin")).toBe("*");
    expect(params?.get("formatversion")).toBe("2");
    expect(params?.get("page")).toBe("Sega");
    expect(headers.get("user-agent")).toBe("avid-wiki-api-test/0.0");
    expect(headers.get("api-user-agent")).toBe("avid-wiki-api-test/0.0");
  });

  it("retries maxlag and then returns the page", async () => {
    const sega = loadFixture("sega.parse.json");
    let attempts = 0;
    const { client } = clientWith(() => {
      attempts += 1;
      if (attempts === 1) {
        return jsonResponse(
          { error: { code: "maxlag", info: "Waiting for 1.2 seconds lagged" } },
          200,
          { "retry-after": "5" },
        );
      }
      return jsonResponse(sega);
    });
    const page = await client.getPage("Sega", { html: false });
    expect(page.pageId).toBe(577);
    expect(attempts).toBe(2);
  });

  it("does not retry a missing page", async () => {
    let attempts = 0;
    const { client } = clientWith(() => {
      attempts += 1;
      return jsonResponse({ error: { code: "missingtitle", info: "The page you specified doesn't exist." } }, 404);
    });
    await expect(client.getPage("Not A Real Page")).rejects.toBeInstanceOf(AvidError);
    expect(attempts).toBe(1);
  });

  it("caches identical requests", async () => {
    const search = loadFixture("search-sega.json");
    let attempts = 0;
    const { client } = clientWith(
      () => {
        attempts += 1;
        return jsonResponse(search);
      },
      { cache: new MemoryCache(60_000) },
    );
    const first = await client.searchPages("Sega", { limit: 3 });
    const second = await client.searchPages("Sega", { limit: 3 });
    expect(first.results[0]?.title).toBe("Sega");
    expect(second.results).toHaveLength(first.results.length);
    expect(first.results[0]?.snippetText).not.toMatch(/<span/);
    expect(attempts).toBe(1);
  });

  it("follows a Production Logos subpage", async () => {
    const parent = loadFixture("nintendo.parse.json");
    const child = loadFixture("nintendo-production-logos.parse.json");
    const { client, calls } = clientWith((params) => {
      return jsonResponse(params.get("page") === "Nintendo" ? parent : child);
    });
    const company = await client.getCompany("Nintendo");
    expect(company.companyName).toBe("Nintendo Co., Ltd.");
    expect(company.logos).toHaveLength(7);
    expect(company.sources).toEqual(["Nintendo", "Nintendo/Production Logos"]);
    expect(company.contentUrl).toBe("https://www.avid.wiki/Nintendo/Production_Logos");
    expect(company.url).toBe("https://www.avid.wiki/Nintendo");
    expect(calls.map((params) => params.get("page"))).toEqual(["Nintendo", "Nintendo/Production Logos"]);
    expect(company.logos[2]?.gameTitle).toBe("King of the Zoo");
  });

  it("resolves redirects and file info from captured responses", async () => {
    const redirect = loadFixture("redirect-capcom.json");
    const images = loadFixture("imageinfo-sega.json");
    const category = loadFixture("category-video-game-logos.json");
    const { client } = clientWith((params) => {
      if (params.get("list") === "categorymembers") return jsonResponse(category);
      if (params.get("prop") === "imageinfo") return jsonResponse(images);
      return jsonResponse(redirect);
    });
    const [resolved] = await client.resolveRedirects(["Capcom"]);
    expect(resolved).toMatchObject({ from: "Capcom", to: "Draft:Capcom", redirected: true });
    const files = await client.getFileInfo(["SEGA logo.svg", "File:Sega (1989).jpeg"]);
    expect(files[0]?.url).toMatch(/upload\.wikimedia\.org/);
    expect(files[0]?.licenseShortName).toBe("Public domain");
    expect(files[0]?.missing).toBe(false);
    expect(files[1]?.url).toMatch(/static\.wikitide\.net/);
    const companies = await client.listVideoGameLogoCompanies({ limit: 10 });
    expect(companies.companies.map((company) => company.title)).toContain("1C Company");
    expect(companies.continue).toBeTruthy();
  });

  it("spaces request starts", async () => {
    const search = loadFixture("search-sega.json");
    const { client } = clientWith(() => jsonResponse(search), { minIntervalMs: 80, retries: 0 });
    const started = Date.now();
    await client.searchPages("a");
    await client.searchPages("b");
    expect(Date.now() - started).toBeGreaterThanOrEqual(70);
  });
});
