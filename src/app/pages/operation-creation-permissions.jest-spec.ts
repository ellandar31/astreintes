import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { createEmptyVisa } from "../shared/visa.models";
import { initialRegularState } from "../state/regular/regular.reducer";
import { initialExceptionalState } from "../state/exceptional/exceptional.reducer";
import { initialSettingsState } from "../state/settings/settings.reducer";
import { initialAuthState } from "../state/auth/auth.reducer";
import { selectCanCreateOperations, selectCanEditPlanning, selectCurrentApplicationUser } from "../state/settings/settings.selectors";
import { ExceptionalActions } from "../state/exceptional/exceptional.actions";
import { RegularActions } from "../state/regular/regular.actions";
import { ExceptionalOperation, RegularOnCallPeriod } from "../types";
import { ExceptionalOperationsComponent } from "./exceptionnel/exceptional-operations.component";
import { RegularCalendarComponent } from "./regular/regular-calendar.component";

const period: RegularOnCallPeriod = {
  id: "1", teamId: "1", userId: "7", userName: "Agent", userEmail: "agent@example.test",
  startDate: "2026-10-10T18:00", endDate: "2026-10-11T08:00",
};
const visa = createEmptyVisa();
const operation: ExceptionalOperation = {
  id: "astreinte:1", type: "astreinte", title: "Existing", initiatorUid: "7", initiatorName: "Agent",
  operationManagerUid: "7", operationManagerName: "Agent", startDate: period.startDate,
  forecastEndDate: period.endDate, actualStartDate: period.startDate, actualEndDate: period.endDate,
  plannedUsers: [], actualUsers: [{ userId: "7", displayName: "Agent", email: period.userEmail,
    startDate: period.startDate, endDate: period.endDate, visa }], interventions: [],
  visas: { plannedInitiator: visa, plannedDirector: visa, actualInitiator: visa, actualDirector: visa },
};

describe("Planning creation permissions", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegularCalendarComponent, ExceptionalOperationsComponent],
      providers: [provideNoopAnimations(), provideMockStore({ initialState: {
        auth: initialAuthState, settings: initialSettingsState,
        regular: { ...initialRegularState, periods: [period] },
        exceptional: { ...initialExceptionalState, operations: [operation] },
      }, selectors: [{ selector: selectCanCreateOperations, value: false },
        { selector: selectCanEditPlanning, value: false },
        { selector: selectCurrentApplicationUser, value: { id: '7', uid: 'auth-id', role: 1, email: period.userEmail, displayName: 'Agent' } }] })],
    }).compileComponents();
  });

  it("blocks regular creation but preserves interventions attached to a saved period", () => {
    const fixture = TestBed.createComponent(RegularCalendarComponent);
    fixture.detectChanges();
    const view = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('.pi-calendar-plus')).toBeNull();
    view.openPeriodModal();
    expect(view.isPeriodModalOpen).toBe(false);
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch");
    dispatch.mockClear();
    view.savePeriod(view.periodForm);
    expect(dispatch).not.toHaveBeenCalled();
    view.openEditPeriodModal(period);
    view.openInterventionForCurrentPeriod();
    expect(view.isInterventionModalOpen).toBe(true);
    view.saveIntervention({ userId: "7", userName: period.userName, userEmail: period.userEmail,
      startDate: "2026-10-10T19:00", endDate: "2026-10-10T20:00", comment: "Test" });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: RegularActions.interventionSaveRequested.type }));
  });

  it.each(["astreinte", "travaux"] as const)("blocks %s creation and accepts interventions only on an existing on-call", type => {
    const fixture = TestBed.createComponent(ExceptionalOperationsComponent);
    fixture.componentRef.setInput("operationType", type);
    fixture.componentRef.setInput("user", { uid: "auth-id", email: period.userEmail, displayName: "Agent" });
    fixture.detectChanges();
    const view = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('.create-actions')).toBeNull();
    view.openCreateModal();
    expect(view.modalMode).toBeNull();
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch");
    dispatch.mockClear();
    view.saveOperation({ ...view.operationForm, type });
    expect(dispatch).not.toHaveBeenCalled();
    view.openInterventionModal(operation);
    expect(view.modalMode).toBe(type === "astreinte" ? "intervention" : null);
    if (type === "astreinte") {
      view.saveIntervention({ userId: "7", userName: period.userName, userEmail: period.userEmail,
        startDate: "2026-10-10T19:00", endDate: "2026-10-10T20:00", wasOnSite: false, label: "Test", comment: "" });
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: ExceptionalActions.interventionsSaveRequested.type }));
    }
  });

  it("preserves creation for an authorized planning role", () => {
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectCanCreateOperations, true);
    store.refreshState();
    const fixture = TestBed.createComponent(RegularCalendarComponent);
    fixture.detectChanges();
    fixture.componentInstance.openPeriodModal();
    expect(fixture.componentInstance.isPeriodModalOpen).toBe(true);
    const exceptional = TestBed.createComponent(ExceptionalOperationsComponent);
    exceptional.componentInstance.openCreateModal();
    expect(exceptional.componentInstance.modalMode).toBe("create-astreinte");
    store.overrideSelector(selectCanCreateOperations, false);
    store.refreshState();
    fixture.detectChanges();
    exceptional.detectChanges();
    expect(fixture.componentInstance.isPeriodModalOpen).toBe(false);
    expect(exceptional.componentInstance.modalMode).toBeNull();
  });

  it("makes regular planning read-only and rejects foreign intervention handlers", async () => {
    const fixture = TestBed.createComponent(RegularCalendarComponent);
    fixture.detectChanges();
    const view = fixture.componentInstance;
    view.openEditPeriodModal(period);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#regular-period-start-date').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('#regular-period-end-date').disabled).toBe(true);
    expect(view.interventionUsers.every(user => user.id === '7')).toBe(true);
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch").mockClear();
    view.savePeriod({ ...view.periodForm, startDate: '2026-10-10T20:00' });
    view.deletePeriod();
    const other = { id: '2', periodId: '1', teamId: '1', userId: '8', userName: 'Other',
      userEmail: 'other@example.test', startDate: period.startDate, endDate: period.endDate, comment: '' };
    view.openEditInterventionModal(other);
    view.deleteIntervention(other);
    view.saveIntervention(other);
    expect(view.isInterventionModalOpen).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it.each(['astreinte', 'travaux'] as const)("makes %s participant dates read-only without allowing foreign interventions", async type => {
    const fixture = TestBed.createComponent(ExceptionalOperationsComponent);
    fixture.componentRef.setInput('operationType', type);
    fixture.detectChanges();
    const view = fixture.componentInstance;
    const current = { ...operation, type, id: type + ':1', plannedUsers: operation.actualUsers };
    view.openEditModal(current);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#planned-start-date-0').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('#actual-end-date-0').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('#operation-planned-user')).toBeNull();
    expect(fixture.nativeElement.querySelector('.pi-save')).toBeNull();
    const dispatch = jest.spyOn(TestBed.inject(MockStore), 'dispatch').mockClear();
    view.saveOperation(view.operationForm);
    view.deleteOperation(current);
    const other = { id: '11', userId: '8', userName: 'Other', userEmail: 'other@example.test',
      startDate: period.startDate, endDate: period.endDate, agentVisa: visa, wasOnSite: false, label: '', comment: '' };
    const withOther = { ...current, interventions: [other] };
    view.openInterventionModal(withOther, other, 0);
    view.deleteIntervention(withOther, 0);
    view.saveIntervention(other);
    expect(view.modalMode).toBe('edit');
    expect(dispatch).not.toHaveBeenCalled();
  });
});

 describe("Droits de l'initiateur par opération", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExceptionalOperationsComponent],
      providers: [provideNoopAnimations(), provideMockStore({ initialState: {
        auth: initialAuthState, settings: initialSettingsState,
        exceptional: { ...initialExceptionalState, operations: [operation] },
      }, selectors: [{ selector: selectCanCreateOperations, value: true },
        { selector: selectCurrentApplicationUser, value: { id: '7', uid: 'auth-id', role: 2,
          email: period.userEmail, displayName: 'Agent' } }] })],
    }).compileComponents();
  });

  it.each(['astreinte', 'travaux'] as const)("autorise le planning %s uniquement à son initiateur", type => {
    const fixture = TestBed.createComponent(ExceptionalOperationsComponent);
    fixture.componentRef.setInput('operationType', type);
    fixture.detectChanges();
    const view = fixture.componentInstance;
    const own = { ...operation, type };
    const foreign = { ...own, initiatorUid: '8' };
    expect(view.canEditOperation(own)).toBe(true);
    expect(view.canEditOperation(foreign)).toBe(false);
    view.openEditModal(foreign);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.pi-save')).toBeNull();
    const dispatch = jest.spyOn(TestBed.inject(MockStore), 'dispatch').mockClear();
    view.saveOperation(view.operationForm);
    view.deleteOperation(foreign);
    expect(dispatch).not.toHaveBeenCalled();
    expect(view.canManageIntervention({ userId: '7' })).toBe(true);
    expect(view.canManageIntervention({ userId: '8' })).toBe(false);
    view.openEditModal(own);
    view.saveOperation(view.operationForm);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: ExceptionalActions.operationSaveRequested.type }));
    // Un transfert saisi dans le formulaire ne doit pas accorder de nouveaux droits.
    view.openEditModal(foreign);
    view.operationForm.initiatorUid = '7';
    dispatch.mockClear();
    view.saveOperation(view.operationForm);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
 describe.each([3, 4] as const)("Accès complet du profil %s aux opérations exceptionnelles", role => {
  it.each(['astreinte', 'travaux'] as const)("autorise la création et la modification de %s d'un autre initiateur", async type => {
    await TestBed.configureTestingModule({
      imports: [ExceptionalOperationsComponent],
      providers: [provideNoopAnimations(), provideMockStore({ initialState: {
        auth: initialAuthState, settings: initialSettingsState,
        exceptional: { ...initialExceptionalState, operations: [operation] },
      }, selectors: [{ selector: selectCanCreateOperations, value: true },
        { selector: selectCurrentApplicationUser, value: { id: '9', uid: 'director-auth', role,
          email: 'director@example.test', displayName: 'Directeur' } }] })],
    }).compileComponents();
    const fixture = TestBed.createComponent(ExceptionalOperationsComponent);
    fixture.componentRef.setInput('operationType', type);
    fixture.detectChanges();
    const view = fixture.componentInstance;
    view.openCreateModal();
    expect(view.modalMode).toBe(`create-${type}`);
    const foreign = { ...operation, type };
    expect(view.canEditOperation(foreign)).toBe(true);
    view.openEditModal(foreign);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.pi-save')).not.toBeNull();
    const dispatch = jest.spyOn(TestBed.inject(MockStore), 'dispatch').mockClear();
    view.saveOperation(view.operationForm);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: ExceptionalActions.operationSaveRequested.type }));
  });
});
