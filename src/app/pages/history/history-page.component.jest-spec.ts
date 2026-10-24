import { RhExceptionalOperation } from "../../types/rh.models";
import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { selectExceptionalOperations, selectExceptionalError } from "../../state/exceptional/exceptional.selectors";
import { selectRegularInterventions, selectRegularPeriods, selectRegularPublicHolidays, selectRegularError } from "../../state/regular/regular.selectors";
import { selectSettingsRhCompensation, selectSettingsUsers } from "../../state/settings/settings.selectors";
import { HistoryPageComponent } from "./history-page.component";
import { RegularActions } from "../../state/regular/regular.actions";

const users = [
  { id: '7', uid: 'auth-id', role: 0, email: 'manager@example.test', displayName: 'Responsable' },
  { id: '8', uid: 'other-auth', role: 1, email: 'other@example.test', displayName: 'Autre agent' },
];

describe("Sélecteur utilisateur des contrôles RH", () => {
  it("keeps archived items in History, cancels an untreated send, and closes the detail when returned to validation", () => {
    const fixture = TestBed.createComponent(HistoryPageComponent);
    fixture.componentRef.setInput('currentUser', { uid: 'auth-id', email: users[0].email, displayName: 'Responsable' });
    fixture.detectChanges();
    const view = fixture.componentInstance;
    view.selectUser('8');
    fixture.detectChanges();
    const item = view.userSections[0].monthSections[0].items[0];
    expect(view.canCancelRhSend(item)).toBe(true);
    view.openDetail(item);
    const store = TestBed.inject(MockStore);
    const dispatch = jest.spyOn(store, 'dispatch');
    view.cancelRhSend(item);
    expect(dispatch).toHaveBeenCalledWith(RegularActions.periodRhSentUpdateRequested({ periodId: 'p1', sent: false }));
    store.overrideSelector(selectRegularPeriods, [{ ...view.regularPeriods[0], treatedAt: '2026-10-24T11:00' }]);
    store.refreshState();
    fixture.detectChanges();
    const treated = view.userSections[0].monthSections[0].items[0];
    expect(treated.treatedAt).toBeDefined();
    expect(view.canCancelRhSend(treated)).toBe(false);
    dispatch.mockClear();
    view.cancelRhSend(treated);
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

  it.each([0, 3, 4] as const)("le profil %s sélectionne une personne et consulte ses contrôles mensuels", role => {
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
