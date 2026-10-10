import { databaseDateTime, dateTimeLocalText } from "./date-time";

describe("Relational date-time boundary", () => {
  it.each([
    ["2026-07-06T16:00:00Z", "2026-07-06T18:00"],
    ["2026-01-06T17:00:00+00:00", "2026-01-06T18:00"],
    ["2026-07-06T18:00:00+02:00", "2026-07-06T18:00"],
    ["2026-07-06 16:00:00+00:00", "2026-07-06T18:00"],
    ["2026-07-06T22:30:00Z", "2026-07-07T00:30"],
    ["2026-03-29T01:30:00Z", "2026-03-29T03:30"],
    ["2026-10-25T01:30:00Z", "2026-10-25T02:30"],
    ["2026-07-06T18:15", "2026-07-06T18:15"],
    [null, ""], [undefined, ""], ["", ""], ["invalid", ""],
  ])("formats %j as %j for a Paris date picker", (value, expected) => {
    const formatted = dateTimeLocalText(value, "Europe/Paris");
    expect(formatted).toBe(expected);
    const input = document.createElement("input");
    input.type = "datetime-local";
    input.value = formatted;
    expect(input.value).toBe(expected);
  });

  it("persists local form values with an explicit timezone and preserves ordinary round trips", () => {
    const local = "2026-07-06T18:15";
    const stored = databaseDateTime(local);
    expect(stored).toMatch(/Z$/);
    expect(dateTimeLocalText(stored)).toBe(local);
  });

  it("preserves an offset-bearing instant on writes", () => {
    expect(databaseDateTime("2026-07-06T18:15:00+02:00")).toBe("2026-07-06T16:15:00.000Z");
  });

  it("keeps optional dates empty and rejects invalid nonempty dates", () => {
    expect(databaseDateTime("")).toBeNull();
    expect(databaseDateTime(null)).toBeNull();
    expect(() => databaseDateTime("invalid")).toThrow("Invalid date-time value.");
  });
});
