import { TestBed } from "@angular/core/testing";
import { Actions } from "@ngrx/effects";
import { Action, Store } from "@ngrx/store";
import { Subject, firstValueFrom } from "rxjs";
import { appStore } from "../store/app-store";
import { ApplicationUser, RegularOnCallPeriod } from "../types";
import { AuthEffects } from "./auth/auth.effects";
import { AuthActions } from "./auth/auth.actions";
import { RegularEffects } from "./regular/regular.effects";
import { RegularActions } from "./regular/regular.actions";
import { ExceptionalEffects } from "./exceptional/exceptional.effects";
import { ExceptionalActions } from "./exceptional/exceptional.actions";
import { SettingsEffects } from "./settings/settings.effects";
import { SettingsActions } from "./settings/settings.actions";
import { ProfileEffects } from "./profile/profile.effects";
import { ProfileActions } from "./profile/profile.actions";

jest.mock("../store/app-store", () => ({
  appStore: {
    now: () => "2026-10-10T08:00:00Z",
    auth: { onSessionChanged: jest.fn(), updateProfile: jest.fn() },
    users: { watch: jest.fn(), watchOne: jest.fn(), get: jest.fn(), save: jest.fn() },
    directions: { watch: jest.fn(), save: jest.fn(), remove: jest.fn() },
    teams: { watch: jest.fn() }, holidays: { watch: jest.fn() },
    regular: { watchPeriods: jest.fn(), watchInterventions: jest.fn(), updatePeriod: jest.fn() },
    exceptional: { watchOperations: jest.fn(), saveOperation: jest.fn() },
    errors: { isError: (error: unknown) => error instanceof Error },
  },
}));

const user: ApplicationUser = {
  id: "7", uid: "auth-id", email: "agent@example.fr", displayName: "Edited profile", role: 3,  signatureName: "Agent"
};
const sessionUser = { uid: user.uid, displayName: null, email: user.email };

describe("NgRx effects using typed domain APIs", () => {
  let actions: Subject<Action>;
  beforeEach(() => {
    jest.resetAllMocks();
    actions = new Subject<Action>();
    TestBed.configureTestingModule({
      providers: [AuthEffects, RegularEffects, ExceptionalEffects, SettingsEffects, ProfileEffects,
        { provide: Actions, useValue: new Actions(actions) }, { provide: Store, useValue: { dispatch: jest.fn() } },
      ]
    });
  });
  afterEach(() => { actions.complete(); TestBed.resetTestingModule(); });

  it("loads directions once per session and clears the reference on logout", () => {
    const stop = jest.fn();
    jest.mocked(appStore.directions.watch).mockImplementation(next => {
      next([{ id: "1", name: "Technique" }]); return stop;
    });
    const received: Action[] = [];
    const subscription = TestBed.inject(SettingsEffects).watchDirections$.subscribe(action => received.push(action));
    actions.next(AuthActions.sessionChanged({ user: sessionUser }));
    expect(received).toContainEqual(SettingsActions.directionsChanged({ directions: [{ id: "1", name: "Technique" }] }));
    actions.next(AuthActions.logoutRequested());
    expect(stop).toHaveBeenCalledTimes(1);
    expect(received[received.length - 1]).toEqual(SettingsActions.directionsChanged({ directions: [] }));
    subscription.unsubscribe();
  });

  it("persists role and direction in one profile update", async () => {
    jest.mocked(appStore.users.save).mockResolvedValue("7");
    const result = firstValueFrom(TestBed.inject(SettingsEffects).updateUserRole$);
    actions.next(SettingsActions.userRoleUpdateRequested({ userId: "7", role: 3, directionId: "1" }));
    await result;
    expect(appStore.users.save).toHaveBeenCalledWith("7", { role: 3, directionId: "1" });
  });

  it("loads permissions at login without settings navigation and clears them on logout or load failure", () => {
    const stop = jest.fn();
    let fail: ((error: unknown) => void) | undefined;
    jest.mocked(appStore.users.watch).mockImplementation((next, error) => {
      next([user]); fail = error; return stop;
    });
    const received: Action[] = [];
    const subscription = TestBed.inject(AuthEffects).watchSessionUsers$.subscribe(action => received.push(action));
    actions.next(AuthActions.sessionChanged({ user: sessionUser }));
    expect(received).toEqual([SettingsActions.usersChanged({ users: [] }), SettingsActions.usersChanged({ users: [user] })]);
    fail?.(new Error("Unavailable"));
    expect(received.at(-1)).toEqual(SettingsActions.usersChanged({ users: [] }));
    actions.next(SettingsActions.usersWatchStopped());
    expect(stop).not.toHaveBeenCalled();
    actions.next(AuthActions.logoutRequested());
    expect(stop).toHaveBeenCalledTimes(1);
    expect(received.at(-1)).toEqual(SettingsActions.usersChanged({ users: [] }));
    subscription.unsubscribe();
  });

  it("publishes typed periods directly and stops all watches on navigation", () => {
    const stop = jest.fn();
    const period: RegularOnCallPeriod = { id: "11", teamId: "2", userId: "7", userName: "Agent", userEmail: user.email, startDate: "2026-10-10T18:00", endDate: "2026-10-11T08:00" };
    jest.mocked(appStore.teams.watch).mockImplementation(next => { next([]); return stop; });
    jest.mocked(appStore.users.watch).mockImplementation(next => { next([user]); return stop; });
    jest.mocked(appStore.regular.watchPeriods).mockImplementation(next => { next([period]); return stop; });
    jest.mocked(appStore.regular.watchInterventions).mockImplementation(next => { next([]); return stop; });
    jest.mocked(appStore.holidays.watch).mockImplementation(next => { next([]); return stop; });
    const received: Action[] = [];
    const subscription = TestBed.inject(RegularEffects).watchRegular$.subscribe(action => received.push(action));
    actions.next(RegularActions.watchStarted());
    expect(received).toContainEqual(RegularActions.periodsChanged({ periods: [period] }));
    actions.next(RegularActions.watchStopped());
    expect(stop).toHaveBeenCalledTimes(5);
    subscription.unsubscribe();
  });

  it("sends an explicit NULL when cancelling a regular RH send", async () => {
    jest.mocked(appStore.regular.updatePeriod).mockResolvedValue("11");
    const result = firstValueFrom(TestBed.inject(RegularEffects).updatePeriodRhSent$);
    actions.next(RegularActions.periodRhSentUpdateRequested({ periodId: "11", sent: false }));
    expect(await result).toEqual(RegularActions.operationSucceeded());
    expect(appStore.regular.updatePeriod).toHaveBeenCalledWith("11", { sentToRhAt: null });
  });

  it("forwards exceptional partial edits without adding legacy document metadata", async () => {
    jest.mocked(appStore.exceptional.saveOperation).mockResolvedValue("31");
    const result = firstValueFrom(TestBed.inject(ExceptionalEffects).patchOperation$);
    actions.next(ExceptionalActions.operationPatchRequested({ operationId: "31", payload: { title: "Changed" } }));
    expect(await result).toEqual(ExceptionalActions.operationSucceeded());
    expect(appStore.exceptional.saveOperation).toHaveBeenCalledWith("31", { title: "Changed" });
  });

  it("keeps application roles, names and signatures out of login synchronization updates", async () => {
    jest.mocked(appStore.users.get).mockResolvedValue(user);
    jest.mocked(appStore.users.save).mockResolvedValue("7");
    const result = firstValueFrom(TestBed.inject(AuthEffects).registerSessionUser$);
    actions.next(AuthActions.sessionChanged({ user: sessionUser }));
    await result;
    expect(appStore.users.save).toHaveBeenCalledWith(user.uid, { uid: user.uid, email: user.email, lastLoginAt: "2026-10-10T08:00:00Z" });
  });

  it("registers a new application user with the standard role", async () => {
    jest.mocked(appStore.users.get).mockResolvedValue(undefined);
    jest.mocked(appStore.users.save).mockResolvedValue("7");
    const result = firstValueFrom(TestBed.inject(AuthEffects).registerSessionUser$);
    actions.next(AuthActions.sessionChanged({ user: sessionUser }));
    await result;
    expect(appStore.users.save).toHaveBeenCalledWith(user.uid, expect.objectContaining({ role: 1, displayName: "" }));
  });


  it("saves only profile fields while aligning the authentication display name", async () => {
    jest.mocked(appStore.auth.updateProfile).mockResolvedValue(undefined);
    jest.mocked(appStore.users.save).mockResolvedValue("7");
    const result = firstValueFrom(TestBed.inject(ProfileEffects).saveProfile$);
    actions.next(ProfileActions.saveRequested({ user: sessionUser, profile: { displayName: "New name", signatureName: "Agent" } }));
    await result;
    expect(appStore.auth.updateProfile).toHaveBeenCalledWith(sessionUser, { displayName: "New name" });
    expect(appStore.users.save).toHaveBeenCalledWith(user.uid, { displayName: "New name", signatureName: "Agent", email: user.email });
  });
});
