import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { AppComponent } from "./app.component";
import { APP_LABELS } from "./i18n/labels";
import { ExceptionalOperationsComponent } from "./pages/exceptionnel/exceptional-operations.component";
import { RegularCalendarComponent } from "./pages/regular/regular-calendar.component";
import { SettingsPageComponent } from "./pages/settings/settings-page.component";
import { selectCanCreateOperations, selectCanOpenSettings, selectCanEditPlanning, selectCurrentApplicationUser, selectOperationInitiators } from "./state/settings/settings.selectors";
import { createEmptyVisa } from "./shared/visa.models";
import { selectAuthError, selectAuthUser, selectDisplayName, selectIsSubmitting, selectLoadingSession } from "./state/auth/auth.selectors";
import { ExceptionalActions } from "./state/exceptional/exceptional.actions";
import { selectExceptionalError, selectVisibleExceptionalOperations, selectExceptionalUsers } from "./state/exceptional/exceptional.selectors";
import { ExceptionalOperation } from "./types";

@Component({ selector: "app-regular-calendar", standalone: true, template: "" })
class RegularCalendarStubComponent { }

@Component({ selector: "app-settings-page", standalone: true, template: "" })
class SettingsPageStubComponent { }

const emptyVisa = createEmptyVisa();
const onCall: ExceptionalOperation = {
  id: "astreinte:1", type: "astreinte", title: "On-call item", initiatorUid: "7", initiatorName: "Agent", operationManagerUid: "7", operationManagerName: "Agent",
  startDate: "2026-10-10T18:00", forecastEndDate: "2026-10-11T08:00", actualStartDate: "2026-10-10T18:00", actualEndDate: "2026-10-11T08:00",
  plannedUsers: [], actualUsers: [], interventions: [],
  visas: { plannedInitiator: emptyVisa, plannedDirector: emptyVisa, actualInitiator: emptyVisa, actualDirector: emptyVisa },
};
const work: ExceptionalOperation = { ...onCall, id: "travaux:1", type: "travaux", title: "Work item" };

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
      remove: { imports: [RegularCalendarComponent, SettingsPageComponent] },
      add: { imports: [RegularCalendarStubComponent, SettingsPageStubComponent] },
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
    expect(fixture.nativeElement.querySelector(".create-actions").textContent).toContain(APP_LABELS.exceptional.actions.addExceptionalOnCall);
    expect(fixture.nativeElement.querySelector(".table-actions .pi-plus")).not.toBeNull();
    workTab.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("h2").textContent).toContain(APP_LABELS.app.tabs.exceptionalWork);
    expect(fixture.nativeElement.querySelector("tbody").textContent).toContain(work.title);
    expect(fixture.nativeElement.querySelector("tbody").textContent).not.toContain(onCall.title);
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

  it("resets filters and modal context on family switches and reattaches the NgRx watch", () => {
    const fixture = createShell();
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch");
    fixture.componentInstance.selectTab("exceptionalOnCall");
    fixture.detectChanges();
    const first = fixture.debugElement.query(By.directive(ExceptionalOperationsComponent)).componentInstance as ExceptionalOperationsComponent;
    first.filters.title = "On-call";
    first.openEditModal(onCall);
    fixture.detectChanges();
    dispatch.mockClear();
    fixture.componentInstance.selectTab("exceptionalWork");
    fixture.detectChanges();
    const next = fixture.debugElement.query(By.directive(ExceptionalOperationsComponent)).componentInstance as ExceptionalOperationsComponent;
    expect(next).not.toBe(first);
    expect(next.filters.title).toBe("");
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
