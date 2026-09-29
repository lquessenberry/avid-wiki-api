# avid-wiki-api

Typed client for the [Audiovisual Identity Database](https://www.avid.wiki/) (AVID), aimed at video game collectors. It wraps the MediaWiki Action API and turns a company article into logo eras: ordinal, variant name, game title, date range, subsection text, and the screenshots attached to each era.

The npm package name is **`avid-wiki-api`**. It was not on the registry when this package was prepared (29 September 2026). Install it from GitHub until it is published:

```bash
npm install github:lquessenberry/avid-wiki-api#cursor/avid-wiki-api-35df
```

The repository is private, so Git must already be able to read it. In `package.json`:

```json
{
  "dependencies": {
    "avid-wiki-api": "github:lquessenberry/avid-wiki-api#cursor/avid-wiki-api-35df"
  }
}
```

After the branch is merged, drop the `#cursor/avid-wiki-api-35df` suffix. A packed tarball works offline:

```bash
npm pack
npm install ./avid-wiki-api-0.1.0.tgz
```

Once it is on the registry, `npm install avid-wiki-api` is enough.

Node.js 18 or newer. The install includes ESM, CommonJS, and TypeScript declarations, so a project can import it without a separate compile. The library uses global `fetch`. It also runs in browsers: requests send MediaWiki's `origin=*` parameter so the wiki's CORS check passes. Browsers block the `User-Agent` header, so the client sends `Api-User-Agent` there instead.

## Attribution

Article text on AVID is licensed under [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/).

If you republish text or structured descriptions you retrieved with this package, you need to:

- credit the Audiovisual Identity Database
- link the source page (every result includes `attribution.sourceUrl`)
- link the [CC BY-SA 4.0 license](https://creativecommons.org/licenses/by-sa/4.0/)
- distribute adaptations under the same license

The `attribution` object on each response records those facts. Attaching it to a JSON payload does not itself satisfy the license if you publish the content somewhere else.

Image files are separate works. A screenshot's license often differs from the article text (public domain, CC BY, and others all show up). `getFileInfo()` and `getCompany(title, { resolveImages: true })` copy `licenseShortName`, `usageTerms`, `artist`, and `credit` from the file page when MediaWiki provides them. Check those before you republish a file.

This package's source code is MIT. That license does not cover wiki content. The project is not affiliated with AVID or Sega Sammy Holdings.

## Quick start

```ts
import { AvidWikiClient, findLogosByGame, findLogosCoveringDate } from "avid-wiki-api";

const avid = new AvidWikiClient();
const sega = await avid.getCompany("Sega");

console.log(sega.companyName); // Sega Corporation
console.log(sega.logos.length); // 15 on 29 September 2026
console.log(sega.attribution.sourceUrl); // https://www.avid.wiki/Sega

const in1991 = findLogosCoveringDate(sega, "1991-06-01");
// 1st Logo (still variants, open-ended from December 1981)
// 4th Logo (October 29, 1988–2002)

const ecco = findLogosByGame(sega, "Ecco");
// 7th Logo, title match, August 25, 1994–December 13, 1996
```

Sega is the reference article: one section per logo era. Nintendo and Konami keep production logos on a subpage (`Nintendo/Production Logos`). `getCompany("Nintendo")` follows `{{/Production Logos}}` when the main article has no logo headings. Commercial-tag and warning-screen subpages are left alone.

The same parser works offline if you already have wikitext:

```ts
import { parseCompanyWikitext } from "avid-wiki-api";

const company = parseCompanyWikitext(wikitext, { title: "Sega" });
```

### Sega, second logo

This is the live parse of the 2nd logo (the 1st is a long "still variants" era running from December 1981 with no end date, about 120 screenshots, and a choir cue). Subsection text is plain text. `description` is the wiki's **Visuals** section.

```json
{
  "ordinal": 2,
  "ordinalLabel": "2nd",
  "heading": "2nd Logo (1983-1987)",
  "label": null,
  "isCustomVariant": false,
  "gameTitle": null,
  "gameTitles": [],
  "dateText": "1983-1987",
  "dateRanges": [
    {
      "raw": "1983-1987",
      "kind": "range",
      "openEnd": false,
      "start": { "year": 1983, "month": null, "day": null, "precision": "year", "iso": "1983", "uncertain": false },
      "end": { "year": 1987, "month": null, "day": null, "precision": "year", "iso": "1987", "uncertain": false }
    }
  ],
  "text": {
    "description": "On a black background is the Sega logo in blue that shimmers.",
    "variants": "Depending on the game, the colors may vary.",
    "technique": "2D sprite animation.",
    "audio": "None, or the opening theme of the game.",
    "availability": "Seen on many SG-1000 games from the period, like Choplifter, H.E.R.O., Bank Panic and Chack'n Pop, among others."
  },
  "primaryImage": { "title": "File:Manufactured by Sega (1985) (Taken from Choplifter, SG-1000).png" },
  "videos": []
}
```

The 4th logo is the one with two separate runs: `October 29, 1988–2002` and `June 22, 2017–April 4, 2019`. Custom variants carry a game title, so the 7th logo is `Ecco` (the heading says "Ecco series custom variant") from August 25, 1994 to December 13, 1996.

## CLI

```bash
npx avid-wiki-api logos Sega --json
npx avid-wiki-api logos Sega --date 1991-06-01
npx avid-wiki-api logos Sega --game "Ecco"
npx avid-wiki-api logos Nintendo
npx avid-wiki-api search "sonic" --limit 5
npx avid-wiki-api companies --limit 20
npx avid-wiki-api file "Sega (1989).jpeg" --json
```

`--images` resolves file URLs (one extra request per 50 files). `--json` prints the typed object, including `attribution`.

## API

### Client

```ts
const avid = new AvidWikiClient({
  userAgent: "my-app/1.0 (https://example.com/avid)",
  maxlag: 5,
  minIntervalMs: 250,
  maxConcurrency: 2,
  retries: 3,
  cache: true,
});
```

| Method | What it calls |
| --- | --- |
| `request(params)` | Any Action API query. POST, `format=json`, `formatversion=2`. |
| `searchPages(query, { limit, offset, namespace })` | `list=search` |
| `getPage(title, { html, redirects })` | `action=parse` with wikitext, HTML, TOC, categories, image names |
| `listCategoryMembers(category, { limit, continue, namespace, type })` | `list=categorymembers`, one page plus `cmcontinue` |
| `iterateCategoryMembers(category)` | Async generator over every member, throttled |
| `listVideoGameLogoCompanies({ limit, continue })` | `Category:Video game logos`, namespace 0, subpages omitted |
| `resolveRedirects(titles)` | `prop=info` with `redirects` |
| `getFileInfo(files, { thumbWidth })` | `prop=imageinfo` (original URL, mime, size, license) |
| `getCompany(title, { followSubpages, resolveImages, thumbWidth })` | Page plus the logo parser |

Defaults: API `https://www.avid.wiki/w/api.php`, `maxlag=5`, at most 2 requests at once, 250ms between starts, 3 retries with exponential backoff. Retries cover HTTP 429/5xx, `maxlag`, and `ratelimited`, and they honor `Retry-After` unless you set `retryBaseDelayMs: 0`. `cache: true` keeps successful responses in memory for 5 minutes. Pass your own store via the `AvidCache` interface if you want something else.

Set `userAgent` to something that describes your app and how to reach you. The default is `avid-wiki-api/0.1.0 (https://github.com/lquessenberry/avid-wiki-api)`.

`listVideoGameLogoCompanies` returns one API page (default 50). The category has about 2,100 members. Pass `continue` to read the next page, or use `iterateCategoryMembers("Category:Video game logos", { namespace: 0, type: "page" })` to walk all of them. Membership is the wiki's category, not a hand-checked list of studios.

### Logo object

`getCompany` / `parseCompanyWikitext` returns a `CompanyLogos` value:

- `companyName`, `description`, `infobox` (`name`, `founded`, `country`, `parent`, `formerly`, `image`)
- `logos[]`, in page order
- `categories`, `warnings`, `sources`, `attribution`, `retrievedAt`

Each `LogoEra` has:

| Field | Meaning |
| --- | --- |
| `ordinal` / `ordinalLabel` | `4` / `"4th"` |
| `heading` | Templates expanded, markup removed |
| `label` | Non-date parenthetical, such as `Still variants` or `Amazing Sega` |
| `isCustomVariant` | Heading says `custom variant` |
| `gameTitle` / `gameTitles` | Related game. ` / ` splits alternate titles. A trailing `series` or `prototype(s)` is removed from the title and kept in `qualifiers`. |
| `dateText` | Date parenthetical, templates expanded, unparsed |
| `dateRanges` | One or more ranges. `raw` is kept. `start` and `end` are `{ year, month, day, precision, iso, uncertain }`. |
| `subsections` | Every bold label (`Visuals`, `Audio Variants`, …) as `{ key, title, text }` |
| `text` | Grouped `description`, `variants`, `technique`, `audio`, `availability`, `trivia` |
| `images` / `primaryImage` | File titles. URLs are filled when you resolve image info. `primaryImage` prefers `{{ImageTOC}}`. |
| `videos` | YouTube ids found in `{{YouTube}}` / `{{youtube}}` |

### Dates

`findLogosCoveringDate(company, "1995-06-01")` also accepts `YYYY`, `YYYY-MM`, and a `Date`. A match is inclusive and respects precision: a year-only end covers that whole year, a month-only end covers that whole month. Several eras usually overlap. The 1st Sega logo is open-ended (`December 1981-`), so it matches every later date along with whichever era was current then. A single day such as `June 4, 2024` matches only that day. A `?` on a year sets `uncertain` and still counts as that year.

`findLogosByGame` returns `{ logo, match }`. `match` is `"title"` when a parsed game title matched, `"text"` when the name showed up in the description, variants, or availability. Title matches are listed first. Pass `{ searchText: false }` to skip the body.

### Other helpers

`parseDateRanges`, `expandDateTemplates`, `parseLogoHeading`, `mapApiCategories`, `pageUrl`, `fileTitle`, and `CC_BY_SA_4_0` are exported. `AvidError` carries `code` and `status` (`missingtitle`, `maxlag` after retries are exhausted, `network`, …).

## Being polite

The client is read-only. It never edits avid.wiki. Please keep the defaults if you are crawling: a real User-Agent, `maxlag`, a low concurrency, and a cache. Listing every video-game logo company is a few hundred kilobytes of titles spread across several requests; parsing every company is not something to do in a tight loop.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
npm pack --dry-run
AVID_LIVE=1 npm run test:live
```

`dist/` is committed so another project can install this package before it is published. `npm run build` refreshes it; commit that output with source changes.

Unit tests replay saved Action API responses for Sega, Namco, Nintendo, Nintendo/Production Logos, and Konami/Production Logos, plus search, category, redirect, and imageinfo payloads. `test:live` is opt-in and hits the wiki once for Sega.

GitHub Actions runs the typecheck, unit tests, build, and `npm pack --dry-run` on Node 18, 20, and 22.

## Parsing limitations

- Logo boundaries are `Nth Logo` headings. Dates are read from that heading, not from prose in the body.
- `{{date}}` is expanded locally the way AVID's template renders, without the per-year search icons the template inserts for editors.
- A comma starts a second range only when the next part begins with a month name (`2002, June 22, 2017`). Semicolons always split. An unparsed span is returned with `kind: "unknown"` and the original text in `raw`.
- `{{Variations}}` transclusions (the "Logo Variations" tab) are not expanded. The result's `warnings` array says so when that template is present.
- Game titles are a heading heuristic. `Ecco series custom variant` becomes `Ecco`. `Sakura Wars / Sakura Taisen` becomes two titles. A parenthetical like `(Hello! Pac-Man in Japan)` is kept as an alternate title.
- Open-ended ranges match every later date. Filter the list if you only want the era introduced for that period.
- Subsection names are whatever the page uses. **Visuals** is exposed as `text.description`. **Audio**, **Audio Variant(s)**, and **Audio Trivia** are joined into `text.audio`, and the original labels remain on `subsections`. A misspelled `AvailabiIity` is treated as availability.
- Unbalanced italics on the wiki (for example `''Gain Ground'.''`) can leave a stray quote in the plain text.
- Wrapped lines are joined. Complex templates other than `{{date}}`, links, and file/YouTube tags are dropped rather than rendered.
- Only `{{/Production Logos}}` (or `{{/Logos}}`) is followed automatically.

## License

MIT for this package's code. See [LICENSE](LICENSE). Wiki content remains CC BY-SA 4.0, as described above.
