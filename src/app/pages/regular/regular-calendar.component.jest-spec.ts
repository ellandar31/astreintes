import { RegularActions } from "../../state/regular/regular.actions";
import { By } from "@angular/platform-browser";
import { Table } from "primeng/table";
import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { selectCanCreateOperations, selectCanEditPlanning, selectCurrentApplicationUser, selectSettingsDirections } from "../../state/settings/settings.selectors";
import { selectRegularError, selectRegularInterventions, selectRegularPeriods, selectRegularPublicHolidays, selectRegularTeams, selectRegularUsers } from "../../state/regular/regular.selectors";
import { RegularCalendarComponent } from "./regular-calendar.component";

describe("Active regular calendar", () => {
  it("defaults to calendar and switches to a filtered team table with live intervention counts", async () => {
    const period = { id: "1", teamId: "1", userId: "7", userName: "Agent", userEmail: "agent@test.fr",
      startDate: "2026-10-24T18:00", endDate: "2026-10-25T08:00" };
    const periods = [period, { ...period, id: "2", sentToRhAt: "2026-10-24T10:00" },
      { ...period, id: "3", treatedAt: "2026-10-24T11:00" }, { ...period, id: "4", teamId: "2" }];
    TestBed.configureTestingModule({ imports: [RegularCalendarComponent], providers: [provideNoopAnimations(), provideMockStore({ selectors: [
      { selector: selectCanCreateOperations, value: true }, { selector: selectCanEditPlanning, value: true },
      { selector: selectCurrentApplicationUser, value: null }, { selector: selectSettingsDirections, value: [] },
      { selector: selectRegularError, value: "" }, { selector: selectRegularInterventions, value: [] },
      { selector: selectRegularPeriods, value: periods }, { selector: selectRegularPublicHolidays, value: [] },
      { selector: selectRegularTeams, value: [] }, { selector: selectRegularUsers, value: [] },
    ] })] });
    const fixture = TestBed.createComponent(RegularCalendarComponent);
    const view = fixture.componentInstance;
    view.selectedTeamId = "1";
    view.currentMonth = new Date(2026, 9, 1);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(view.viewMode()).toBe("calendar");
    expect(fixture.nativeElement.querySelector("app-calendar")).not.toBeNull();
    expect(fixture.nativeElement.querySelector(".regular-table-view").hidden).toBe(true);
    expect(view.calendarEntries()).toHaveLength(3);
    const toggle = fixture.nativeElement.querySelectorAll(".view-switcher p-togglebutton");
    toggle[0].click(); fixture.detectChanges();
    expect(view.viewMode()).toBe("table");
    expect(fixture.nativeElement.querySelector("app-calendar")).toBeNull();
    expect(view.tablePeriods().map(row => row.id)).toEqual(["1"]);
    const table = fixture.debugElement.query(By.directive(Table)).componentInstance as Table;
    expect(table.value[0].interventionCount).toBe(0);
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectRegularInterventions, [{ ...period, id: "i", periodId: "1", comment: "", ticket: "INC-1" }]);
    store.refreshState(); fixture.detectChanges();
    expect(table.value[0].interventionCount).toBe(1);
    fixture.nativeElement.querySelector(".regular-table-view tbody p-button button").click();
    fixture.detectChanges();
    expect(view.editingPeriodId).toBe("1");
    view.closePeriodModal();
    const rowButtons = fixture.nativeElement.querySelectorAll(".regular-table-view tbody p-button button");
    expect(rowButtons).toHaveLength(3);
    expect(rowButtons[0].querySelector(".pi-pencil")).not.toBeNull();
    expect(rowButtons[1].querySelector(".pi-trash")).not.toBeNull();
    expect(rowButtons[2].querySelector(".pi-plus")).not.toBeNull();
    rowButtons[2].click(); fixture.detectChanges();
    expect(view.interventionPeriodId).toBe("1");
    expect(view.isInterventionModalOpen).toBe(true);
    expect(view.isPeriodModalOpen).toBe(false);
    view.closeInterventionModal();
    const dispatch = jest.spyOn(store, "dispatch").mockClear();
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
    try {
      rowButtons[1].click();
      expect(confirm).toHaveBeenCalled();
      expect(dispatch).not.toHaveBeenCalled();
      confirm.mockReturnValue(true);
      rowButtons[1].click();
      expect(dispatch).toHaveBeenCalledWith(RegularActions.periodDeleteRequested({
        periodId: "1", interventions: [{ id: "i", periodId: "1" }],
      }));
      dispatch.mockClear(); confirm.mockClear();
      store.overrideSelector(selectCanEditPlanning, false);
      store.overrideSelector(selectCurrentApplicationUser, { id: "8", uid: "other", role: 1, email: "other@test.fr" });
      store.refreshState(); fixture.detectChanges();
      const readOnlyButtons = fixture.nativeElement.querySelectorAll(".regular-table-view tbody p-button button");
      expect(readOnlyButtons).toHaveLength(1);
      expect(readOnlyButtons[0].querySelector(".pi-eye")).not.toBeNull();
      view.deletePeriod("1");
      view.openInterventionForPeriod(period);
      expect(confirm).not.toHaveBeenCalled();
      expect(dispatch).not.toHaveBeenCalled();
      expect(view.isInterventionModalOpen).toBe(false);
    } finally { confirm.mockRestore(); }
    table.filters = { tableUser: { value: "Agent", matchMode: "contains" } };
    toggle[1].click(); fixture.detectChanges();
    expect(view.viewMode()).toBe("calendar");
    toggle[0].click(); fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(Table)).componentInstance).toBe(table);
    expect(table.filters["tableUser"]).toEqual({ value: "Agent", matchMode: "contains" });
    view.selectedTeamId = "2"; fixture.detectChanges();
    expect(view.tablePeriods().map(row => row.id)).toEqual(["4"]);
  });

  it("shows sent and treated periods greyed out without allowing opening", () => {
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
    expect(view.periods.map(item => item.id)).toEqual([period.id, "2"]);
    expect(view.isPeriodModalOpen).toBe(false);
    expect(view.isInterventionModalOpen).toBe(false);
    const bars = Array.from(fixture.nativeElement.querySelectorAll(".calendar-entry")) as HTMLElement[];
    expect(bars.length).toBeGreaterThan(0);
    expect(bars.every(bar => bar.classList.contains("entry-disabled") && bar.getAttribute("aria-disabled") === "true")).toBe(true);
    for (const bar of bars) {
      bar.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
      fixture.detectChanges();
      expect(view.isPeriodModalOpen).toBe(false);
    }
    view.openEditPeriodModal(period);
    expect(view.isPeriodModalOpen).toBe(false);
    view.openEditPeriodModal({ ...period, id: "2" });
    expect(view.isPeriodModalOpen).toBe(false);
    expect(view.isPeriodArchived({ ...period, treatedAt: "2026-10-24T11:00" })).toBe(true);
    expect(view.isPeriodArchived(period)).toBe(false);
  });
});
