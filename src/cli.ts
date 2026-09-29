#!/usr/bin/env node
import {
  AvidError,
  AvidWikiClient,
  findLogosByGame,
  findLogosCoveringDate,
  type CompanyLogos,
  type DateEndpoint,
  type DateRange,
  type LogoEra,
} from "./index.js";

interface Flags {
  json: boolean;
  images: boolean;
  cache: boolean;
  help: boolean;
  date?: string;
  game?: string;
  limit?: number;
  userAgent?: string;
  apiUrl?: string;
  thumb?: number;
  subpages: boolean;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

async function main(argv: string[]): Promise<void> {
  const { command, positionals, flags } = parseArgs(argv);
  if (flags.help || !command || command === "help") {
    printHelp();
    return;
  }
  const client = new AvidWikiClient({
    userAgent: flags.userAgent,
    apiUrl: flags.apiUrl,
    cache: flags.cache,
  });

  switch (command) {
    case "logos":
      await logosCommand(client, positionals, flags);
      return;
    case "search":
      await searchCommand(client, positionals, flags);
      return;
    case "companies":
      await companiesCommand(client, flags);
      return;
    case "page":
      await pageCommand(client, positionals, flags);
      return;
    case "file":
      await fileCommand(client, positionals, flags);
      return;
    default:
      throw new AvidError(`Unknown command "${command}". Run with --help.`, { code: "usage" });
  }
}

async function logosCommand(client: AvidWikiClient, positionals: string[], flags: Flags): Promise<void> {
  const title = positionals.join(" ");
  if (!title) throw new AvidError("Usage: avid-wiki-api logos <page>", { code: "usage" });
  let company = await client.getCompany(title, {
    resolveImages: flags.images,
    followSubpages: flags.subpages,
    thumbWidth: flags.thumb,
  });
  let logos = company.logos;
  if (flags.game) {
    logos = findLogosByGame(company, flags.game).map((match) => match.logo);
  }
  if (flags.date) {
    const covered = new Set(findLogosCoveringDate(logos, flags.date));
    logos = logos.filter((logo) => covered.has(logo));
  }
  if (flags.json) {
    const payload = flags.game || flags.date ? { ...company, logos } : company;
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  printCompany(company, logos);
}

async function searchCommand(client: AvidWikiClient, positionals: string[], flags: Flags): Promise<void> {
  const query = positionals.join(" ");
  if (!query) throw new AvidError("Usage: avid-wiki-api search <query>", { code: "usage" });
  const page = await client.searchPages(query, { limit: flags.limit ?? 10 });
  if (flags.json) {
    console.log(JSON.stringify(page, null, 2));
    return;
  }
  if (page.results.length === 0) {
    console.log("No pages matched.");
    return;
  }
  for (const result of page.results) {
    console.log(`${result.title}  ${result.url}`);
    if (result.snippetText) console.log(`  ${result.snippetText}`);
  }
}

async function companiesCommand(client: AvidWikiClient, flags: Flags): Promise<void> {
  const page = await client.listVideoGameLogoCompanies({ limit: flags.limit ?? 20 });
  if (flags.json) {
    console.log(JSON.stringify(page, null, 2));
    return;
  }
  for (const company of page.companies) console.log(company.title);
  if (page.continue) console.error(`\nMore results. Pass the continuation token to listCategoryMembers (${page.continue}).`);
}

async function pageCommand(client: AvidWikiClient, positionals: string[], flags: Flags): Promise<void> {
  const title = positionals.join(" ");
  if (!title) throw new AvidError("Usage: avid-wiki-api page <title>", { code: "usage" });
  const page = await client.getPage(title, { html: false });
  if (flags.json) {
    console.log(JSON.stringify(page, null, 2));
    return;
  }
  console.log(`${page.title}  ${page.url}`);
  console.log(`${page.sections.length} sections, ${page.images.length} images, rev ${page.revisionId ?? "?"}`);
  if (page.redirectedFrom) console.log(`Redirected from ${page.redirectedFrom}`);
  console.log(page.attribution.license.shortName);
}

async function fileCommand(client: AvidWikiClient, positionals: string[], flags: Flags): Promise<void> {
  const name = positionals.join(" ");
  if (!name) throw new AvidError("Usage: avid-wiki-api file <filename>", { code: "usage" });
  const [info] = await client.getFileInfo(name, flags.thumb ? { thumbWidth: flags.thumb } : {});
  if (!info) throw new AvidError(`No file info for "${name}"`, { code: "missing" });
  if (flags.json) {
    console.log(JSON.stringify(info, null, 2));
    return;
  }
  console.log(info.title);
  console.log(info.url ?? "(no url)");
  if (info.licenseShortName) console.log(info.licenseShortName);
  if (info.mime) console.log(`${info.mime}  ${info.width ?? "?"}×${info.height ?? "?"}`);
}

function printCompany(company: CompanyLogos, logos: LogoEra[]): void {
  console.log(`${company.companyName} — ${logos.length} logo ${logos.length === 1 ? "era" : "eras"}`);
  console.log(company.contentUrl);
  console.log(`${company.attribution.license.shortName} — credit ${company.attribution.siteName} if you republish this.`);
  if (company.description) {
    const sentence = company.description.replace(/\s+/g, " ");
    console.log("");
    console.log(truncate(sentence, 280));
  }
  console.log("");
  for (const logo of logos) {
    const name = logo.label ? `${logo.ordinalLabel} Logo (${logo.label})` : `${logo.ordinalLabel} Logo`;
    console.log(`${logo.ordinal}. ${name}`);
    const dates = logo.dateRanges.map(formatRange).join("; ");
    if (dates) console.log(`   ${dates}`);
    if (logo.gameTitles.length > 0) console.log(`   Game: ${logo.gameTitles.join(" / ")}`);
    const bits = [`${logo.images.length} images`];
    if (logo.videos.length > 0) bits.push(`${logo.videos.length} videos`);
    console.log(`   ${bits.join(", ")}`);
  }
  if (company.warnings.length > 0) {
    console.log("");
    for (const warning of company.warnings) console.log(`Note: ${warning}`);
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function formatRange(range: DateRange): string {
  if (range.kind === "unknown" || !range.start) return range.raw;
  const start = formatEndpoint(range.start);
  if (range.kind === "instant") return start;
  if (range.openEnd || !range.end) return `${start} – present`;
  const end = formatEndpoint(range.end);
  return `${start} – ${end}${range.end.uncertain ? "?" : ""}`;
}

function formatEndpoint(endpoint: DateEndpoint): string {
  const month = endpoint.month ? MONTHS[endpoint.month - 1] : null;
  if (endpoint.precision === "day" && month && endpoint.day) return `${month} ${endpoint.day}, ${endpoint.year}`;
  if (endpoint.precision === "month" && month) return `${month} ${endpoint.year}`;
  return String(endpoint.year);
}

function parseArgs(argv: string[]): { command: string | undefined; positionals: string[]; flags: Flags } {
  const flags: Flags = { json: false, images: false, cache: false, help: false, subpages: true };
  const positionals: string[] = [];
  let command: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (arg === "--") continue;
    if (arg === "--json") flags.json = true;
    else if (arg === "--images") flags.images = true;
    else if (arg === "--cache") flags.cache = true;
    else if (arg === "--help" || arg === "-h") flags.help = true;
    else if (arg === "--no-subpages") flags.subpages = false;
    else if (arg === "--date") flags.date = requireValue(argv, i++, "--date");
    else if (arg === "--game") flags.game = requireValue(argv, i++, "--game");
    else if (arg === "--limit") flags.limit = Number(requireValue(argv, i++, "--limit"));
    else if (arg === "--user-agent") flags.userAgent = requireValue(argv, i++, "--user-agent");
    else if (arg === "--api-url") flags.apiUrl = requireValue(argv, i++, "--api-url");
    else if (arg === "--thumb") flags.thumb = Number(requireValue(argv, i++, "--thumb"));
    else if (arg.startsWith("--")) throw new AvidError(`Unknown option ${arg}`, { code: "usage" });
    else if (!command) command = arg;
    else positionals.push(arg);
  }
  return { command, positionals, flags };
}

function requireValue(argv: string[], index: number, name: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new AvidError(`${name} needs a value`, { code: "usage" });
  return value;
}

function printHelp(): void {
  console.log(`avid-wiki-api — read logo histories from the Audiovisual Identity Database

Usage:
  avid-wiki-api logos <page> [--json] [--images] [--date YYYY-MM-DD] [--game title]
  avid-wiki-api search <query> [--limit N] [--json]
  avid-wiki-api companies [--limit N] [--json]
  avid-wiki-api page <title> [--json]
  avid-wiki-api file <filename> [--json]

Options:
  --json           Print the full typed result
  --images         Resolve file URLs (extra API calls)
  --cache          Cache identical requests for 5 minutes
  --date           Keep logo eras that cover this date
  --game           Keep logo eras tied to this game
  --limit          Page size for search and companies
  --thumb          Thumbnail width in pixels, with --images or file
  --no-subpages    Do not follow {{/Production Logos}}
  --user-agent     Override the descriptive User-Agent
  --api-url        Override the Action API URL

Wiki text is CC BY-SA 4.0. Credit https://www.avid.wiki and share derivatives alike.
`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
