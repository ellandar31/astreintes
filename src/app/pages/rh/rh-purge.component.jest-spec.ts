import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { selectCanExportRh } from "../../state/settings/settings.selectors";
import { RhPurgeActions, RhPurgeState, selectRhPurge, rhPurgeReducer } from "../../state/rh-purge/rh-purge.state";
import { RhPurgeComponent } from "./rh-purge.component";

const state: RhPurgeState = { years: 2, loading: false, purging: false, error: "", deletedCount: null,
  operations: [{ id: "7", type: "regular", title: "Old operation", treatedAt: "2020-01-01T12:00:00Z" }] };

describe("RH purge preview and confirmation", () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [RhPurgeComponent], providers: [
    provideNoopAnimations(), provideMockStore({ selectors: [
      { selector: selectCanExportRh, value: true }, { selector: selectRhPurge, value: state },
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
