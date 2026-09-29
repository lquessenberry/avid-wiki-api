import { describe, expect, it } from "vitest";
import { expandDateTemplates, parseDateRanges, renderDateTemplate } from "../src/parse/dates.js";

describe("date template", () => {
  it("renders the forms used on company pages", () => {
    expect(renderDateTemplate({ year: "1983" })).toBe("1983");
    expect(renderDateTemplate({ month: "October", day: "29", year: "1988" })).toBe("October 29, 1988");
    expect(renderDateTemplate({ month: "November", day: "8", day2: "14", year: "1996" })).toBe("November 8-14, 1996");
    expect(
      renderDateTemplate({ month: "February", day: "24", month2: "September", day2: "21", year: "2000" }),
    ).toBe("February 24-September 21, 2000");
    expect(renderDateTemplate({ month: "December", month2: "", year: "1992" })).toBe("December 1992");
    expect(renderDateTemplate({ month: "May", day: "22", month2: "June", day2: "30", year: "2000" })).toBe(
      "May 22-June 30, 2000",
    );
  });

  it("expands templates inside a heading", () => {
    const raw = "4th Logo ({{date|month=October|day=29|year=1988}}-2002, {{date|month=June|day=22|year=2017}}-April 4, 2019)";
    expect(expandDateTemplates(raw)).toBe(
      "4th Logo (October 29, 1988-2002, June 22, 2017-April 4, 2019)",
    );
  });
});

describe("parseDateRanges", () => {
  function span(input: string) {
    return parseDateRanges(input).map((range) => ({
      kind: range.kind,
      start: range.start?.iso ?? null,
      end: range.end?.iso ?? null,
      openEnd: range.openEnd,
      uncertain: Boolean(range.end?.uncertain),
      precision: range.start?.precision ?? null,
    }));
  }

  it("parses the Sega and sibling heading patterns", () => {
    expect(span("December 1981-")).toEqual([
      { kind: "open-ended", start: "1981-12", end: null, openEnd: true, uncertain: false, precision: "month" },
    ]);
    expect(span("1983-1987")).toEqual([
      { kind: "range", start: "1983", end: "1987", openEnd: false, uncertain: false, precision: "year" },
    ]);
    expect(span("October 29, 1988-2002, June 22, 2017-April 4, 2019")).toEqual([
      { kind: "range", start: "1988-10-29", end: "2002", openEnd: false, uncertain: false, precision: "day" },
      { kind: "range", start: "2017-06-22", end: "2019-04-04", openEnd: false, uncertain: false, precision: "day" },
    ]);
    expect(span("March-September 1989")).toEqual([
      { kind: "range", start: "1989-03", end: "1989-09", openEnd: false, uncertain: false, precision: "month" },
    ]);
    expect(span("December 4, 1992-1993?")).toEqual([
      { kind: "range", start: "1992-12-04", end: "1993", openEnd: false, uncertain: true, precision: "day" },
    ]);
    expect(span("November 8-14, 1996")).toEqual([
      { kind: "range", start: "1996-11-08", end: "1996-11-14", openEnd: false, uncertain: false, precision: "day" },
    ]);
    expect(span("February 24-September 21, 2000")).toEqual([
      { kind: "range", start: "2000-02-24", end: "2000-09-21", openEnd: false, uncertain: false, precision: "day" },
    ]);
    expect(span("May 18, 2017-")).toEqual([
      { kind: "open-ended", start: "2017-05-18", end: null, openEnd: true, uncertain: false, precision: "day" },
    ]);
    expect(span("June 4, 2024")).toEqual([
      { kind: "instant", start: "2024-06-04", end: "2024-06-04", openEnd: false, uncertain: false, precision: "day" },
    ]);
    expect(span("July 14, 1993-December 1994; December 12, 2010")).toEqual([
      { kind: "range", start: "1993-07-14", end: "1994-12", openEnd: false, uncertain: false, precision: "day" },
      { kind: "instant", start: "2010-12-12", end: "2010-12-12", openEnd: false, uncertain: false, precision: "day" },
    ]);
    expect(span("September 1991")).toEqual([
      { kind: "instant", start: "1991-09", end: "1991-09", openEnd: false, uncertain: false, precision: "month" },
    ]);
    expect(span("March 19-August 1993")).toEqual([
      { kind: "range", start: "1993-03-19", end: "1993-08", openEnd: false, uncertain: false, precision: "day" },
    ]);
    expect(span("December 1981-July 25, 1986")).toEqual([
      { kind: "range", start: "1981-12", end: "1986-07-25", openEnd: false, uncertain: false, precision: "month" },
    ]);
    expect(span("May 22-June 30, 2000")).toEqual([
      { kind: "range", start: "2000-05-22", end: "2000-06-30", openEnd: false, uncertain: false, precision: "day" },
    ]);
    expect(span("February 1992-1998")).toEqual([
      { kind: "range", start: "1992-02", end: "1998", openEnd: false, uncertain: false, precision: "month" },
    ]);
  });
});
