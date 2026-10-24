import { TestBed } from "@angular/core/testing";
import { Actions } from "@ngrx/effects";
import { Action } from "@ngrx/store";
import { Subject, firstValueFrom } from "rxjs";
import { appStore } from "../../store/app-store";
import { RhPurgeEffects } from "./rh-purge.effects";
import { RhPurgeActions } from "./rh-purge.state";

jest.mock("../../store/app-store", () => ({ appStore: { rhPurge: { preview: jest.fn(), purge: jest.fn() } } }));

describe("RH purge effects", () => {
  let actions: Subject<Action>;
  beforeEach(() => {
    jest.resetAllMocks(); actions = new Subject<Action>();
    TestBed.configureTestingModule({ providers: [RhPurgeEffects, { provide: Actions, useValue: new Actions(actions) }] });
  });
  afterEach(() => actions.complete());

  it("loads the server preview and reports permission or network failures", async () => {
    jest.mocked(appStore.rhPurge.preview).mockResolvedValue([]);
    let result = firstValueFrom(TestBed.inject(RhPurgeEffects).preview$);
    actions.next(RhPurgeActions.previewRequested({ years: 2 }));
    expect(await result).toEqual(RhPurgeActions.previewLoaded({ operations: [] }));
    expect(appStore.rhPurge.preview).toHaveBeenCalledWith(2);
    jest.mocked(appStore.rhPurge.preview).mockRejectedValue(new Error("Denied"));
    result = firstValueFrom(TestBed.inject(RhPurgeEffects).preview$);
    actions.next(RhPurgeActions.previewRequested({ years: 1 }));
    expect((await result).type).toBe(RhPurgeActions.failed.type);
  });

  it("ignores repeated confirmations until the first purge finishes", async () => {
    jest.mocked(appStore.rhPurge.purge).mockResolvedValue(3);
    const result = firstValueFrom(TestBed.inject(RhPurgeEffects).purge$);
    const action = RhPurgeActions.purgeRequested({ years: 2, operations: [] });
    actions.next(action); actions.next(action);
    expect(await result).toEqual(RhPurgeActions.purgeCompleted({ count: 3 }));
    expect(appStore.rhPurge.purge).toHaveBeenCalledTimes(1);
  });
});
