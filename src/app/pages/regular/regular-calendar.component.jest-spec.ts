import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { selectCanCreateOperations, selectCanEditPlanning, selectCurrentApplicationUser, selectSettingsDirections } from "../../state/settings/settings.selectors";
import { selectRegularError, selectRegularInterventions, selectRegularPeriods, selectRegularPublicHolidays, selectRegularTeams, selectRegularUsers } from "../../state/regular/regular.selectors";
import { RegularCalendarComponent } from "./regular-calendar.component";

describe("Active regular calendar", () => {
  it("shows sent periods greyed out without allowing opening, and hides treated periods", () => {
    const period = { id: "1", teamId: "1", userId: "7", userName: "Agent", userEmail: "agent@test.fr", startDate: "2026-10-24T18:00", endDate: "2026-10-25T08:00" };
    TestBed.configureTestingModule({ imports: [RegularCalendarComponent], providers: [provideNoopAnimations(), provideMockStore({ selectors: [
      { selector: selectCanCreateOperations, value: true }, { selector: selectCanEditPlanning, value: true },
      { selector: selectCurrentApplicationUser, value: null }, { selector: selectSettingsDirections, value: [] },
      { selector: selectRegularError, value: "" }, { selector: selectRegularInterventions, value: [] },
      { selector: selectRegularPeriods, value: [period] }, { selector: selectRegularPublicHolidays, value: [] },
      { selector: selectRegularTeams, value: [] }, { selector: selectRegularUsers, value: [] },
    ] })] });
    const fixture = TestBed.createComponent(RegularCalendarComponent);
    fixture.componentInstance.currentMonth = new Date(2026, 9, 1);
    fixture.componentInstance.selectedTeamId = "1";
    fixture.detectChanges();
    const view = fixture.componentInstance;
    expect(view.periods).toEqual([period]);
    view.editingPeriodId = period.id;
    view.isPeriodModalOpen = true;
    view.interventionPeriodId = period.id;
    view.isInterventionModalOpen = true;
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectRegularPeriods, [{ ...period, sentToRhAt: "2026-10-24T10:00" }, { ...period, id: "2", treatedAt: "2026-10-24T11:00" }]);
    store.refreshState();
    fixture.detectChanges();
    expect(view.periods.map(item => item.id)).toEqual([period.id]);
    expect(view.isPeriodModalOpen).toBe(false);
    expect(view.isInterventionModalOpen).toBe(false);
    const bars = Array.from(fixture.nativeElement.querySelectorAll(".period-bar")) as HTMLElement[];
    expect(bars.length).toBeGreaterThan(0);
    expect(bars.every(bar => bar.classList.contains("period-archived") && bar.getAttribute("aria-disabled") === "true")).toBe(true);
    bars[0].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    fixture.detectChanges();
    expect(view.isPeriodModalOpen).toBe(false);
    view.openEditPeriodModal(period);
    expect(view.isPeriodModalOpen).toBe(false);
  });
});
