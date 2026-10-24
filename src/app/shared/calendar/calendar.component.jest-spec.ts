import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { CalendarComponent } from "./calendar.component";
import { CalendarEntry } from "./calendar.models";
import { buildCalendarDays } from "./calendar.utils";

/** Calendar rules are tested without any operation family, role or persistence dependency. */
describe("Shared monthly calendar", () => {
  it("builds six Monday-first weeks, including leap days and adjacent months", () => {
    const days = buildCalendarDays(new Date(2024, 1, 1), [], []);
    expect(days).toHaveLength(42);
    expect(days[0].dateKey).toBe("2024-01-29");
    expect(days[41].dateKey).toBe("2024-03-10");
    expect(days.filter(day => day.isCurrentMonth)).toHaveLength(29);
    expect(days.some(day => day.dateKey === "2024-02-29" && day.isCurrentMonth)).toBe(true);
  });

  it("keeps day keys continuous across daylight saving and displays inclusive event bounds", () => {
    const entry = Object.freeze({ id: "event", label: "Appointment", startDate: "2026-03-28T18:00", endDate: "2026-03-30T08:00" });
    const entries = Object.freeze([entry]);
    const days = buildCalendarDays(new Date(2026, 2, 1), entries, [{ date: "2026-03-29", label: "Special day" }]);
    expect(new Set(days.map(day => day.dateKey)).size).toBe(42);
    expect(days.filter(day => day.entries.length).map(day => day.dateKey)).toEqual(["2026-03-28", "2026-03-29", "2026-03-30"]);
    expect(days.find(day => day.dateKey === "2026-03-28")?.entries[0].isStart).toBe(true);
    const middle = days.find(day => day.dateKey === "2026-03-29")!;
    expect(middle.entries[0].isStart).toBe(false);
    expect(middle.holiday?.label).toBe("Special day");
    const april = buildCalendarDays(new Date(2026, 3, 1), entries, []);
    expect(april.find(day => day.entries.length)?.entries[0].colorIndex).toBe(middle.entries[0].colorIndex);
    expect(entries).toEqual([entry]);
  });

  it("emits month changes and activations while blocking disabled entries", () => {
    TestBed.configureTestingModule({ imports: [CalendarComponent], providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(CalendarComponent);
    const month = new Date(2026, 11, 1);
    const entry: CalendarEntry = { id: "free", label: "Appointment", startDate: "2026-12-15", endDate: "2026-12-15" };
    fixture.componentRef.setInput("month", month);
    fixture.componentRef.setInput("entries", [entry, { ...entry, id: "disabled", label: "Closed", disabled: true }]);
    fixture.componentRef.setInput("holidays", [{ date: "2026-12-15", label: "Special day" }]);
    fixture.detectChanges();
    const activated = jest.fn();
    fixture.componentInstance.entryActivated.subscribe(activated);
    const bars = fixture.nativeElement.querySelectorAll(".calendar-entry");
    bars[0].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(activated).toHaveBeenCalledWith(entry);
    activated.mockClear();
    bars[1].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    bars[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(activated).not.toHaveBeenCalled();
    expect(bars[1].getAttribute("aria-disabled")).toBe("true");
    expect(fixture.nativeElement.querySelector(".holiday-label").textContent).toContain("Special day");
    const cachedDays = fixture.componentInstance.days();
    fixture.detectChanges();
    expect(fixture.componentInstance.days()).toBe(cachedDays);
    const changed = jest.fn();
    fixture.componentInstance.month.subscribe(changed);
    fixture.componentInstance.changeMonth(1);
    expect(changed).toHaveBeenCalledWith(new Date(2027, 0, 1));
    expect(month).toEqual(new Date(2026, 11, 1));
    fixture.componentInstance.changeMonth(-1);
    expect(fixture.componentInstance.month()).toEqual(month);
  });
});
