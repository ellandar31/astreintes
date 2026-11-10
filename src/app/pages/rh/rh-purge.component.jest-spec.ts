import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { selectCanExportRh, selectSettingsUsers } from "../../state/settings/settings.selectors";
import { RhPurgeActions, RhPurgeState, selectRhPurge, rhPurgeReducer } from "../../state/rh-purge/rh-purge.state";
import { RhPurgeComponent } from "./rh-purge.component";

const state: RhPurgeState = { years: 2, userId: null, loading: false, purging: false, error: "", deletedCount: null,
  operations: [{ id: "7", type: "regular", title: "Old operation", treatedAt: "2020-01-01T12:00:00Z" }] };

describe("RH purge preview and confirmation", () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [RhPurgeComponent], providers: [
    provideNoopAnimations(), provideMockStore({ selectors: [
      { selector: selectCanExportRh, value: true }, { selector: selectRhPurge, value: state },
      { selector: selectSettingsUsers, value: [{ id: "2", email: "agent@example.test", displayName: "Agent", role: 1, deletedAt: "2026-01-01" }] },
    ] }),
  ] }));

  it("loads a two-year preview and purges only after explicit confirmation", () => {
    const store = TestBed.inject(MockStore); const dispatch = jest.spyOn(store, "dispatch");
    const fixture = TestBed.createComponent(RhPurgeComponent); fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(dispatch).toHaveBeenCalledWith(RhPurgeActions.previewRequested({ years: 2 }));
    dispatch.mockClear(); component.confirmPurge(); expect(dispatch).not.toHaveBeenCalled();
    component.openConfirmation(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("app-modal")).not.toBeNull();
    component.confirmPurge();
    expect(dispatch).toHaveBeenCalledWith(RhPurgeActions.purgeRequested({ years: 2, operations: state.operations }));
    dispatch.mockClear(); component.confirmPurge(); expect(dispatch).not.toHaveBeenCalled();
  });

  it("cancels confirmation on retention change and refuses stale or unauthorized confirmation", () => {
    const store = TestBed.inject(MockStore);
    const fixture = TestBed.createComponent(RhPurgeComponent); fixture.detectChanges();
    const component = fixture.componentInstance; const dispatch = jest.spyOn(store, "dispatch");
    component.openConfirmation(); component.refresh(1);
    expect(component.confirming()).toBe(false);
    expect(dispatch).toHaveBeenCalledWith(RhPurgeActions.previewRequested({ years: 1 }));
    store.overrideSelector(selectRhPurge, { ...state, loading: true }); store.refreshState();
    component.openConfirmation(); expect(component.confirming()).toBe(false);
    store.overrideSelector(selectCanExportRh, false); store.refreshState(); fixture.detectChanges();
    dispatch.mockClear(); component.refresh(); component.openConfirmation(); component.confirmPurge();
    expect(dispatch).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector("p-card")).toBeNull();
  });

  it("previews and confirms only the selected user's treated participations", () => {
    const store = TestBed.inject(MockStore);
    const dispatch = jest.spyOn(store, "dispatch");
    const fixture = TestBed.createComponent(RhPurgeComponent);
    fixture.componentRef.setInput("userMode", true); fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(dispatch).not.toHaveBeenCalledWith(RhPurgeActions.previewRequested({ years: 2 }));
    expect(component.userOptions().map(user => user.id)).toEqual(["2"]);
    component.selectUser("2");
    expect(dispatch).toHaveBeenCalledWith(RhPurgeActions.userPreviewRequested({ userId: "2" }));
    const operations = [{ ...state.operations[0], type: "exceptionalWork" as const, deleteOperation: false }];
    store.overrideSelector(selectRhPurge, { ...state, operations, userId: "2" }); store.refreshState(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(component.userCopyLabels.keepOperation);
    component.openConfirmation(); component.confirmPurge();
    expect(dispatch).toHaveBeenCalledWith(RhPurgeActions.userPurgeRequested({ userId: "2", operations }));
  });

  it("distinguishes same-title rows and shows the whole operation with its purge impact", () => {
    const store = TestBed.inject(MockStore);
    const dispatch = jest.spyOn(store, "dispatch");
    const fixture = TestBed.createComponent(RhPurgeComponent);
    fixture.componentRef.setInput("userMode", true);
    const row = { ...state.operations[0], type: "exceptionalOnCall" as const, deleteOperation: false,
      startsAt: "2020-01-01T12:00:00Z", endsAt: "2020-01-02T12:00:00Z" };
    const other = { ...row, id: "8", startsAt: "2020-01-03T12:00:00Z" };
    const preview = { ...state, userId: "2", operations: [row, other] };
    const selection = store.overrideSelector(selectRhPurge, preview);
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("01/01/2020");
    expect(rows[1].textContent).toContain("03/01/2020");
    (rows[0].querySelector("button") as HTMLButtonElement).click();
    expect(dispatch).toHaveBeenCalledWith(RhPurgeActions.detailRequested({ row, userId: "2" }));
    const visa = { signed: false, signedAt: "", signedByName: "", signedByUid: "" };
    const participant = { userId: "2", displayName: "Agent ciblé", email: "", startDate: row.startsAt, endDate: row.endsAt, visa };
    selection.setResult({ ...preview, detail: { row, userId: "2", data: {
      type: "exceptional", operation: {
        id: "astreinte:7", type: "astreinte", title: row.title, initiatorName: "Initiateur", initiatorUid: "3",
        operationManagerName: "Responsable", operationManagerUid: "3", startDate: row.startsAt, forecastEndDate: row.endsAt,
        actualStartDate: row.startsAt, actualEndDate: row.endsAt, treatedAt: row.treatedAt,
        plannedUsers: [], actualUsers: [participant, { ...participant, userId: "3", displayName: "Autre participant" }],
        interventions: [], visas: { plannedInitiator: visa, plannedDirector: visa, actualInitiator: visa, actualDirector: visa },
      },
    } } });
    store.refreshState(); fixture.detectChanges();
    const detailRows = fixture.nativeElement.querySelectorAll("app-rh-purge-detail tbody tr");
    expect(detailRows[0].textContent).toContain("Agent ciblé");
    expect(detailRows[0].textContent).toContain("Sera supprimé");
    expect(detailRows[1].textContent).toContain("Autre participant");
    expect(detailRows[1].textContent).toContain("Sera conservé");
  });

  it("discards obsolete previews on a new request, errors and closure", () => {
    const loading = rhPurgeReducer(state, RhPurgeActions.previewRequested({ years: 1 }));
    expect(loading.operations).toEqual([]); expect(loading.loading).toBe(true);
    const failed = rhPurgeReducer(state, RhPurgeActions.failed({ error: "Stale preview" }));
    expect(failed.operations).toEqual([]);
    const completed = rhPurgeReducer(state, RhPurgeActions.purgeCompleted({ count: 1 }));
    expect(completed.operations).toEqual([]); expect(completed.deletedCount).toBe(1);
    expect(rhPurgeReducer(state, RhPurgeActions.closed()).operations).toEqual([]);
  });
});
