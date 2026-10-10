import { formatDate, formatRange } from "./rh-export-utils";

describe("RH export date formatting", () => {
  it.each([
    ["2026-07-06", "lun"], ["2026-07-07", "mar"],
    ["2026-07-08", "mer"], ["2026-07-09", "jeu"],
    ["2026-07-10", "ven"], ["2026-07-11", "sam"],
    ["2026-07-12", "dim"],
  ])("prefixes %s with %s", (date, weekday) => {
    const localDate = `${date}T12:00:00`;
    expect(formatDate(localDate)).toBe(`${weekday} ${date.slice(8)}/${date.slice(5, 7)}/2026`);
  });

  it("keeps both days and times in a range across midnight", () => {
    expect(formatRange("2026-07-11T23:00:00", "2026-07-12T01:00:00"))
      .toBe("sam 11/07/2026 23:00 - dim 12/07/2026 01:00");
  });

  it("uses the local calendar day consistently for offset timestamps", () => {
    const value = "2026-07-11T23:30:00-05:00";
    const date = new Date(value);
    const weekdays = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
    expect(formatDate(value)).toBe(`${weekdays[date.getDay()]} ${new Intl.DateTimeFormat("fr-FR").format(date)}`);
  });

  it("keeps absent dates empty", () => {
    expect(formatDate("")).toBe("");
  });
});
