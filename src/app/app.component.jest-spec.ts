import { Table } from "primeng/table";
import { Component, Input } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { UsersSettingsComponent } from "./pages/settings/users-settings.component";
import { AppComponent } from "./app.component";
import { APP_LABELS } from "./i18n/labels";
import { ExceptionalOperationsComponent } from "./pages/exceptional-common/exceptional-operations.component";
import { RegularCalendarComponent } from "./pages/regular/regular-calendar.component";
import { HistoryPageComponent } from "./pages/history/history-page.component";
import { SettingsPageComponent } from "./pages/settings/settings-page.component";
import { selectCanCreateOperations, selectCanManageUsers, selectCanOpenSettings, selectCanEditPlanning, selectCurrentApplicationUser, selectOperationInitiators } from "./state/settings/settings.selectors";
import { createEmptyVisa } from "./shared/visa.models";
import { selectAuthError, selectAuthUser, selectDisplayName, selectIsSubmitting, selectLoadingSession } from "./state/auth/auth.selectors";
import { ExceptionalActions } from "./state/exceptional/exceptional.actions";
import { selectExceptionalError, selectVisibleExceptionalOperations, selectExceptionalUsers } from "./state/exceptional/exceptional.selectors";
import { ExceptionalOperation } from "./types";

@Component({ selector: "app-regular-calendar", standalone: true, template: "" })
class RegularCalendarStubComponent { }

@Component({ selector: "app-settings-page", standalone: true, template: "" })
class SettingsPageStubComponent { }

@Component({ selector: "app-history-page", standalone: true, template: "History" })
class HistoryStubComponent { @Input() currentUser: unknown; }

const emptyVisa = createEmptyVisa();
const onCall: ExceptionalOperation = {
  id: "astreinte:1", type: "astreinte", title: "On-call item", initiatorUid: "7", initiatorName: "Agent", operationManagerUid: "7", operationManagerName: "Agent",
  startDate: "2026-10-10T18:00", forecastEndDate: "2026-10-11T08:00", actualStartDate: "2026-10-10T18:00", actualEndDate: "2026-10-11T08:00",
  plannedUsers: [], actualUsers: [], interventions: [],
  visas: { plannedInitiator: emptyVisa, plannedDirector: emptyVisa, actualInitiator: emptyVisa, actualDirector: emptyVisa },
};
const work: ExceptionalOperation = { ...onCall, id: "travaux:1", type: "travaux", title: "Work item" };

@Component({ selector: "app-users-settings", standalone: true, template: "" })
class UsersSettingsStubComponent { @Input() readOnly = false; @Input() allowAccountActions = false; }

function createShell() {
  const fixture = TestBed.createComponent(AppComponent);
  fixture.detectChanges();
  return fixture;
}


describe("Separate exceptional navigation", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideNoopAnimations(), provideMockStore({ selectors: [
        { selector: selectAuthUser, value: { uid: "auth-id", email: "agent@example.fr", displayName: "Agent" } },
        { selector: selectDisplayName, value: "Agent" },
        { selector: selectLoadingSession, value: false },
        { selector: selectAuthError, value: "" },
        { selector: selectIsSubmitting, value: false },
        { selector: selectCanManageUsers, value: false },
        { selector: selectCanOpenSettings, value: false },
        { selector: selectCanCreateOperations, value: true },
        { selector: selectCanEditPlanning, value: true },
        { selector: selectCurrentApplicationUser, value: { id: "7", uid: "auth-id", role: 2, email: "agent@example.fr", displayName: "Agent" } },
        { selector: selectOperationInitiators, value: [{ id: "7", role: 2, email: "agent@example.fr", displayName: "Agent" }] },
        { selector: selectVisibleExceptionalOperations, value: [onCall, work] },
        { selector: selectExceptionalUsers, value: [] },
        { selector: selectExceptionalError, value: "" },
      ] })],
    }).overrideComponent(AppComponent, {
      remove: { imports: [RegularCalendarComponent, SettingsPageComponent, HistoryPageComponent, UsersSettingsComponent] },
      add: { imports: [RegularCalendarStubComponent, SettingsPageStubComponent, HistoryStubComponent, UsersSettingsStubComponent] },
    }).compileComponents();
  });

  it("hides settings and refuses opening it for ordinary users", () => {
    const fixture = createShell();
    expect(fixture.nativeElement.querySelector('.pi-cog')).toBeNull();
    fixture.componentInstance.showSettings();
    fixture.detectChanges();
    expect(fixture.componentInstance.modalView).toBeNull();
    expect(fixture.nativeElement.querySelector('app-settings-page')).toBeNull();
  });

  it("opens account review only for user managers and closes it if permission is revoked", () => {
    const fixture = createShell();
    const store = TestBed.inject(MockStore);
    expect(fixture.nativeElement.querySelector(".pi-users")).toBeNull();
    fixture.componentInstance.showAccountReview();
    expect(fixture.componentInstance.modalView).toBeNull();
    const permission = store.overrideSelector(selectCanManageUsers, true);
    store.refreshState(); fixture.detectChanges();
    (fixture.nativeElement.querySelector(".pi-users").closest("button") as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("app-users-settings")).not.toBeNull();
    expect(fixture.componentInstance.activeTab).toBe("regular");
    permission.setResult(false); store.refreshState(); fixture.detectChanges();
    expect(fixture.componentInstance.modalView).toBeNull();
    expect(fixture.nativeElement.querySelector("app-users-settings")).toBeNull();
  });

  it("opens History from the main navigation", () => {
    const fixture = createShell();
    const history = (Array.from(fixture.nativeElement.querySelectorAll("nav button")) as HTMLButtonElement[])
      .find(button => button.textContent?.trim() === APP_LABELS.app.tabs.history)!;
    history.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("app-history-page")).not.toBeNull();
    expect(fixture.nativeElement.querySelector("app-rh-page")).toBeNull();
    expect(history.getAttribute("aria-current")).toBe("page");
  });

  it("shows the RH navigation for a flagged user and hides it when the flag is removed", () => {
    const fixture = createShell();
    const store = TestBed.inject(MockStore);
    expect(fixture.componentInstance.tabs.some(tab => tab.id === "rh")).toBe(false);
    const profile = { id: "7", uid: "auth-id", role: 1 as const, email: "agent@example.fr", displayName: "Agent", signatureName: "Agent" };
    store.overrideSelector(selectCurrentApplicationUser, { ...profile, isRh: true });
    store.refreshState();
    fixture.detectChanges();
    expect(fixture.componentInstance.tabs.some(tab => tab.id === "rh")).toBe(true);
    store.overrideSelector(selectCurrentApplicationUser, { ...profile, isRh: false });
    store.refreshState();
    fixture.detectChanges();
    expect(fixture.componentInstance.tabs.some(tab => tab.id === "rh")).toBe(false);
  });

  it("removes sent and treated exceptional operations from active lists, including an open modal", () => {
    const fixture = createShell();
    fixture.componentInstance.selectTab("exceptionalOnCall");
    fixture.detectChanges();
    const view = fixture.debugElement.query(By.directive(ExceptionalOperationsComponent)).componentInstance as ExceptionalOperationsComponent;
    view.openEditModal(onCall);
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectVisibleExceptionalOperations, [
      { ...onCall, sentToRhAt: "2026-10-24T10:00" },
      { ...onCall, id: "astreinte:2", treatedAt: "2026-10-24T11:00" },
      work,
    ]);
    store.refreshState();
    fixture.detectChanges();
    expect(view.filteredOperations).toEqual([]);
    expect(view.modalMode).toBeNull();
  });

  it("shows settings for authorized roles and closes it when permission is revoked", () => {
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectCanOpenSettings, true);
    store.refreshState();
    const fixture = createShell();
    expect(fixture.nativeElement.querySelector('.pi-cog')).not.toBeNull();
    fixture.componentInstance.showSettings();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-settings-page')).not.toBeNull();
    store.overrideSelector(selectCanOpenSettings, false);
    store.refreshState();
    fixture.detectChanges();
    expect(fixture.componentInstance.modalView).toBeNull();
    expect(fixture.nativeElement.querySelector('.pi-cog')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-settings-page')).toBeNull();
  });


  it("opens each family from its own tab without mixing rows or creation actions", () => {
    const fixture = createShell();
    const tabs = Array.from(fixture.nativeElement.querySelectorAll("nav button")) as HTMLButtonElement[];
    expect(tabs).toHaveLength(5);
    const onCallTab = tabs.find(button => button.textContent?.trim() === APP_LABELS.app.tabs.exceptionalOnCall)!;
    const workTab = tabs.find(button => button.textContent?.trim() === APP_LABELS.app.tabs.exceptionalWork)!;
    onCallTab.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("h2").textContent).toContain(APP_LABELS.app.tabs.exceptionalOnCall);
    expect(fixture.nativeElement.querySelector("tbody").textContent).toContain(onCall.title);
    expect(fixture.nativeElement.querySelector("tbody").textContent).not.toContain(work.title);
    expect(fixture.nativeElement.querySelector("thead").textContent).toContain(APP_LABELS.exceptional.fields.endDateFilter);
    expect(fixture.nativeElement.querySelector("tbody tr").cells[3].textContent.trim()).toBe("2026-10-11");
    expect(fixture.nativeElement.querySelector(".create-actions").textContent).toContain(APP_LABELS.exceptional.actions.addExceptionalOnCall);
    expect(fixture.nativeElement.querySelector(".table-actions .pi-plus")).not.toBeNull();
    workTab.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("h2").textContent).toContain(APP_LABELS.app.tabs.exceptionalWork);
    expect(fixture.nativeElement.querySelector("tbody").textContent).toContain(work.title);
    expect(fixture.nativeElement.querySelector("tbody").textContent).not.toContain(onCall.title);
    expect(fixture.nativeElement.querySelector("tbody tr").cells[3].textContent.trim()).toBe("2026-10-11");
    expect(fixture.nativeElement.querySelector(".create-actions").textContent).toContain(APP_LABELS.exceptional.actions.addExceptionalWork);
    expect(fixture.nativeElement.querySelector(".table-actions .pi-plus")).toBeNull();
    expect(workTab.getAttribute("aria-current")).toBe("page");
    expect(onCallTab.getAttribute("aria-current")).toBeNull();
  });

  it.each(["exceptionalOnCall", "exceptionalWork"] as const)("creates the right family from %s", tab => {
    const fixture = createShell();
    fixture.componentInstance.selectTab(tab);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector(".create-actions button") as HTMLButtonElement).click();
    fixture.detectChanges();
    const view = fixture.debugElement.query(By.directive(ExceptionalOperationsComponent)).componentInstance as ExceptionalOperationsComponent;
    const type = tab === "exceptionalOnCall" ? "astreinte" : "travaux";
    expect(view.operationForm.type).toBe(type);
    expect(view.modalMode).toBe(`create-${type}`);
    expect(fixture.nativeElement.querySelector("dialog")).not.toBeNull();
  });

  it.each(["exceptionalOnCall", "exceptionalWork"] as const)("switches %s between table and shared calendar without losing table filters", async tab => {
    const fixture = createShell();
    fixture.componentInstance.selectTab(tab);
    fixture.detectChanges();
    await fixture.whenStable();
    const view = fixture.debugElement.query(By.directive(ExceptionalOperationsComponent)).componentInstance as ExceptionalOperationsComponent;
    view.currentMonth = new Date(2026, 9, 1);
    expect(view.viewMode()).toBe("table");
    expect(fixture.nativeElement.querySelector("app-calendar")).toBeNull();
    const table = fixture.debugElement.query(By.directive(Table)).componentInstance as Table;
    table.filters = { title: { value: "item", matchMode: "contains" } };
    const buttons = fixture.nativeElement.querySelectorAll(".view-switcher p-togglebutton");
    expect(buttons).toHaveLength(2);
    buttons[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(view.viewMode()).toBe("calendar");
    expect(fixture.nativeElement.querySelector(".operation-table-view").hidden).toBe(true);
    const expected = tab === "exceptionalOnCall" ? onCall : work;
    const other = tab === "exceptionalOnCall" ? work : onCall;
    const calendar = fixture.nativeElement.querySelector("app-calendar");
    expect(calendar.textContent).toContain(expected.title);
    expect(calendar.textContent).not.toContain(other.title);
    expect(view.calendarEntries()).toHaveLength(1);
    const stale = view.calendarEntries()[0];
    calendar.querySelector(".calendar-entry").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    fixture.detectChanges();
    expect(view.selectedOperation?.id).toBe(expected.id);
    expect(view.modalMode).toBe("edit");
    view.closeModal();
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectVisibleExceptionalOperations, [
      { ...expected, sentToRhAt: "2026-10-24T10:00" },
      { ...expected, id: `${expected.id}:treated`, treatedAt: "2026-10-24T11:00" }, other,
    ]);
    store.refreshState();
    fixture.detectChanges();
    expect(view.calendarEntries()).toHaveLength(2);
    expect(view.calendarEntries().every(entry => entry.disabled)).toBe(true);
    expect(view.filteredOperations).toEqual([]);
    const archivedBars = Array.from(calendar.querySelectorAll(".calendar-entry")) as HTMLElement[];
    expect(archivedBars.length).toBeGreaterThan(0);
    for (const bar of archivedBars) {
      expect(bar.classList.contains("entry-disabled")).toBe(true);
      expect(bar.getAttribute("aria-disabled")).toBe("true");
      bar.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    }
    expect(view.modalMode).toBeNull();
    view.openCalendarEntry(stale);
    expect(view.modalMode).toBeNull();
    buttons[0].click();
    fixture.detectChanges();
    expect(view.viewMode()).toBe("table");
    expect(fixture.nativeElement.querySelector(".operation-table-view").hidden).toBe(false);
    expect(fixture.debugElement.query(By.directive(Table)).componentInstance).toBe(table);
    expect(table.filters["title"]).toEqual({ value: "item", matchMode: "contains" });
  });

  it("resets filters and modal context on family switches and reattaches the NgRx watch", () => {
    const fixture = createShell();
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch");
    fixture.componentInstance.selectTab("exceptionalOnCall");
    fixture.detectChanges();
    const first = fixture.debugElement.query(By.directive(ExceptionalOperationsComponent)).componentInstance as ExceptionalOperationsComponent;
    const firstTable = fixture.debugElement.query(By.directive(Table)).componentInstance as Table;
    firstTable.filters = { title: { value: "On-call", matchMode: "contains" } };
    first.openEditModal(onCall);
    fixture.detectChanges();
    dispatch.mockClear();
    fixture.componentInstance.selectTab("exceptionalWork");
    fixture.detectChanges();
    const next = fixture.debugElement.query(By.directive(ExceptionalOperationsComponent)).componentInstance as ExceptionalOperationsComponent;
    expect(next).not.toBe(first);
    const nextTable = fixture.debugElement.query(By.directive(Table)).componentInstance as Table;
    expect(nextTable.filters["title"]).toEqual([expect.objectContaining({ value: null })]);
    expect(next.selectedOperation).toBeNull();
    expect(next.modalMode).toBeNull();
    expect(dispatch).toHaveBeenCalledWith(ExceptionalActions.watchStopped());
    expect(dispatch).toHaveBeenCalledWith(ExceptionalActions.watchStarted());
  });

  it("rejects opening or saving the other family from the active view", () => {
    const fixture = createShell();
    fixture.componentInstance.selectTab("exceptionalWork");
    fixture.detectChanges();
    const view = fixture.debugElement.query(By.directive(ExceptionalOperationsComponent)).componentInstance as ExceptionalOperationsComponent;
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch");
    dispatch.mockClear();
    view.openEditModal(onCall);
    view.openInterventionModal(onCall);
    view.saveOperation(onCall);
    view.deleteOperation(onCall);
    expect(view.modalMode).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
