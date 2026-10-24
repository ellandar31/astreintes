import { RhExceptionalOperation } from "../../types/rh.models";
import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { selectExceptionalOperations, selectExceptionalError } from "../../state/exceptional/exceptional.selectors";
import { selectRegularInterventions, selectRegularPeriods, selectRegularPublicHolidays, selectRegularError } from "../../state/regular/regular.selectors";
import { selectSettingsRhCompensation, selectSettingsUsers } from "../../state/settings/settings.selectors";
import { HistoryPageComponent } from "./history-page.component";
import { HistoryDetailModalComponent } from "./history-detail-modal.component";

const users = [
  { id: '7', uid: 'auth-id', role: 0, email: 'manager@example.test', displayName: 'Responsable' },
  { id: '8', uid: 'other-auth', role: 1, email: 'other@example.test', displayName: 'Autre agent' },
];

describe("Sélecteur utilisateur des contrôles RH", () => {
  it("shows each intervention ticket in historical details without mixing identical time ranges", () => {
    const store = TestBed.inject(MockStore);
    const intervention = {
      id: "i1", periodId: "p1", teamId: "t1", userId: "8", userName: "Autre agent", userEmail: users[1].email,
      startDate: "2026-10-01T19:00", endDate: "2026-10-01T20:00", comment: "",
    };
    store.overrideSelector(selectRegularInterventions, [
      { ...intervention, ticket: "REG-A" }, { ...intervention, id: "i2", ticket: "REG-B" },
    ]);
    store.overrideSelector(selectExceptionalOperations, [{
      id: "astreinte:1", type: "astreinte", title: "Exceptional", initiatorUid: "7", initiatorName: "Responsable",
      operationManagerName: "", startDate: "2026-10-01T18:00", forecastEndDate: "2026-10-02T08:00",
      actualStartDate: "2026-10-01T18:00", actualEndDate: "2026-10-02T08:00", sentToRhAt: "2026-10-03T10:00",
      plannedUsers: [], actualUsers: [], interventions: [{ ...intervention, ticket: "EXC-123" }],
    }]);
    const fixture = TestBed.createComponent(HistoryPageComponent);
    fixture.componentRef.setInput("currentUser", { uid: "auth-id", email: users[0].email, displayName: "Responsable" });
    fixture.detectChanges();
    const view = fixture.componentInstance;
    view.selectUser("8");
    fixture.detectChanges();
    const items = view.userSections[0].monthSections.flatMap(month => month.items);
    const regular = items.find(item => item.sourceId === "p1")!;
    expect(regular.lines.filter(line => line.ticket).map(line => line.ticket)).toEqual(["REG-A", "REG-B"]);
    const detail = TestBed.createComponent(HistoryDetailModalComponent);
    detail.componentRef.setInput("item", regular);
    detail.detectChanges();
    expect(detail.nativeElement.querySelector(".detail-table").textContent).toContain("REG-A");
    expect(detail.nativeElement.querySelector(".detail-table").textContent).toContain("REG-B");
    detail.componentRef.setInput("item", items.find(item => item.sourceId === "astreinte:1")!);
    detail.detectChanges();
    expect(detail.nativeElement.querySelector(".detail-table").textContent).toContain("EXC-123");
  });

  it("keeps archived items in History and closes the detail when returned to validation", () => {
    const fixture = TestBed.createComponent(HistoryPageComponent);
    fixture.componentRef.setInput('currentUser', { uid: 'auth-id', email: users[0].email, displayName: 'Responsable' });
    fixture.detectChanges();
    const view = fixture.componentInstance;
    view.selectUser('8');
    fixture.detectChanges();
    const item = view.userSections[0].monthSections[0].items[0];
    view.openDetail(item);
    const store = TestBed.inject(MockStore);
    const dispatch = jest.spyOn(store, 'dispatch');
    store.overrideSelector(selectRegularPeriods, [{ ...view.regularPeriods[0], treatedAt: '2026-10-24T11:00' }]);
    store.refreshState();
    fixture.detectChanges();
    const treated = view.userSections[0].monthSections[0].items[0];
    expect(treated.treatedAt).toBeDefined();
    dispatch.mockClear();
    expect(dispatch).not.toHaveBeenCalled();
    store.overrideSelector(selectRegularPeriods, [{ ...view.regularPeriods[0], sentToRhAt: undefined, treatedAt: undefined }]);
    store.refreshState();
    fixture.detectChanges();
    expect(view.userSections[0].itemCount).toBe(0);
    expect(view.selectedDetailItem).toBeNull();
  });
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HistoryPageComponent], providers: [
      provideNoopAnimations(), provideMockStore({ selectors: [
        { selector: selectSettingsUsers, value: users },
        { selector: selectRegularError, value: "" },
        { selector: selectExceptionalError, value: "" },
        { selector: selectRegularPeriods, value: [{ id: 'p1', userId: '8', userName: 'Autre agent',
          userEmail: 'other@example.test', startDate: '2026-10-01T18:00', endDate: '2026-10-02T08:00',
          sentToRhAt: '2026-10-03T10:00' }] },
        { selector: selectRegularInterventions, value: [] },
        { selector: selectRegularPublicHolidays, value: [] },
        { selector: selectExceptionalOperations, value: [] },
        { selector: selectSettingsRhCompensation, value: null },
      ] }),
    ] }).compileComponents();
  });

  it.each([0, 3] as const)("le profil %s sélectionne une personne et consulte ses contrôles mensuels", role => {
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectSettingsUsers, [{ ...users[0], role }, users[1]]);
    store.refreshState();
    const fixture = TestBed.createComponent(HistoryPageComponent);
    fixture.componentRef.setInput('currentUser', { uid: 'auth-id', email: users[0].email, displayName: 'Responsable' });
    fixture.detectChanges();
    const view = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('#history-selected-user')).not.toBeNull();
    expect(view.selectedUserId).toBe('7');
    expect(view.userSections.map(section => section.user.id)).toEqual(['7']);
    view.selectUser('8');
    fixture.detectChanges();
    expect(view.userSections.map(section => section.user.id)).toEqual(['8']);
    expect(fixture.nativeElement.querySelector('.month-label').textContent).toContain('octobre 2026');
    expect(fixture.nativeElement.querySelector('.user-section-header')).toBeNull();
    expect(fixture.nativeElement.querySelector('.user-section')).toBeNull();
    expect(fixture.nativeElement.querySelector('tbody tr')).not.toBeNull();
    const monthButton = fixture.nativeElement.querySelector('.month-section-header') as HTMLButtonElement;
    monthButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('tbody')).toBeNull();
    monthButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('tbody tr')).not.toBeNull();
    view.openDetail(view.userSections[0].monthSections[0].items[0]);
    view.selectUser('7');
    fixture.detectChanges();
    expect(view.selectedDetailItem).toBeNull();
    expect(view.userSections.map(section => section.user.id)).toEqual(['7']);
    expect(view.userSections[0].itemCount).toBe(0);
  });

  it("masque le sélecteur à un utilisateur et refuse de consulter une autre personne", () => {
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectSettingsUsers, [{ ...users[0], role: 1 }, users[1]]);
    store.refreshState();
    const fixture = TestBed.createComponent(HistoryPageComponent);
    fixture.componentRef.setInput('currentUser', { uid: 'auth-id', email: users[0].email, displayName: 'Responsable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('p-select')).toBeNull();
    fixture.componentInstance.selectUser('8');
    expect(fixture.componentInstance.userSections.map(section => section.user.id)).toEqual(['7']);
  });

  it.each(['astreinte', 'travaux'] as const)("limite le contrôle %s de l'initiateur aux opérations initiées ou participées", type => {
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectSettingsUsers, [{ ...users[0], role: 2 }, users[1]]);
    const other = { userId: '8', displayName: 'Autre agent', email: users[1].email,
      startDate: '2026-10-01T18:00', endDate: '2026-10-02T08:00' };
    const self = { ...other, userId: '7', displayName: 'Responsable', email: users[0].email };
    const base: RhExceptionalOperation = {
      id: `${type}:1`, type, title: 'Initiée', initiatorUid: '7', initiatorName: 'Responsable',
      operationManagerName: '', startDate: other.startDate, forecastEndDate: other.endDate,
      actualStartDate: other.startDate, actualEndDate: other.endDate,
      plannedUsers: [other], actualUsers: [other], interventions: [], sentToRhAt: '2026-10-03T10:00',
    };
    const operations: RhExceptionalOperation[] = [base,
      { ...base, id: `${type}:2`, title: 'Participation prévisionnelle', initiatorUid: '9', plannedUsers: [self, other] },
      { ...base, id: `${type}:3`, title: 'Participation réelle', initiatorUid: '9', actualUsers: [self, other] },
      { ...base, id: `${type}:4`, title: 'Non autorisée', initiatorUid: '9' },
    ];
    store.overrideSelector(selectExceptionalOperations, operations);
    store.refreshState();
    const fixture = TestBed.createComponent(HistoryPageComponent);
    fixture.componentRef.setInput('currentUser', { uid: 'auth-id', email: users[0].email, displayName: 'Responsable' });
    fixture.detectChanges();
    const view = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('p-select')).not.toBeNull();
    view.selectUser('8');
    fixture.detectChanges();
    const items = view.userSections[0].monthSections.flatMap(month => month.items);
    expect(items.map(item => item.title)).toEqual(['Initiée', 'Participation prévisionnelle', 'Participation réelle']);
    expect(items.every(item => item.id.startsWith('exceptional-'))).toBe(true);
    view.openDetail(items[0]);
    // Retirer sa qualité d'initiateur ferme aussi un détail devenu inaccessible.
    store.overrideSelector(selectExceptionalOperations, operations.map(operation => ({ ...operation, initiatorUid: '9' })));
    store.refreshState();
    fixture.detectChanges();
    expect(view.selectedDetailItem).toBeNull();
    expect(view.userSections[0].monthSections.flatMap(month => month.items).map(item => item.title))
      .toEqual(['Participation prévisionnelle', 'Participation réelle']);
  });
});
