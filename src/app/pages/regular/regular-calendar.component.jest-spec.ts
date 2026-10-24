import { TestBed } from "@angular/core/testing";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { selectCanCreateOperations, selectCanEditPlanning, selectCurrentApplicationUser, selectSettingsDirections } from "../../state/settings/settings.selectors";
import { selectRegularError, selectRegularInterventions, selectRegularPeriods, selectRegularPublicHolidays, selectRegularTeams, selectRegularUsers } from "../../state/regular/regular.selectors";
import { RegularCalendarComponent } from "./regular-calendar.component";

describe("Active regular calendar", () => {
  it("removes sent and treated periods and closes the editing modal on archive", () => {
    const period = { id: "1", teamId: "1", userId: "7", userName: "Agent", userEmail: "agent@test.fr", startDate: "2026-10-24T18:00", endDate: "2026-10-25T08:00" };
    TestBed.configureTestingModule({ imports: [RegularCalendarComponent], providers: [provideMockStore({ selectors: [
      { selector: selectCanCreateOperations, value: true }, { selector: selectCanEditPlanning, value: true },
      { selector: selectCurrentApplicationUser, value: null }, { selector: selectSettingsDirections, value: [] },
      { selector: selectRegularError, value: "" }, { selector: selectRegularInterventions, value: [] },
      { selector: selectRegularPeriods, value: [period] }, { selector: selectRegularPublicHolidays, value: [] },
      { selector: selectRegularTeams, value: [] }, { selector: selectRegularUsers, value: [] },
    ] })] }).overrideComponent(RegularCalendarComponent, { set: { template: "" } });
    const fixture = TestBed.createComponent(RegularCalendarComponent);
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
    expect(view.periods).toEqual([]);
    expect(view.isPeriodModalOpen).toBe(false);
    expect(view.isInterventionModalOpen).toBe(false);
  });
});
