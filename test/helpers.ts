import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(here, "fixtures", name), "utf8")) as T;
}

export function fixtureWikitext(name: string): { title: string; pageId: number; wikitext: string; categories: unknown } {
  const data = loadFixture<{
    parse: { title: string; pageid: number; wikitext: string; categories: unknown };
  }>(name);
  return {
    title: data.parse.title,
    pageId: data.parse.pageid,
    wikitext: data.parse.wikitext,
    categories: data.parse.categories,
  };
}
