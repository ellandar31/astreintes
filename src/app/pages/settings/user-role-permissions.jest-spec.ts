import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { selectAuthUser } from "../../state/auth/auth.selectors";
import { SettingsActions } from "../../state/settings/settings.actions";
import { selectOperationInitiators, selectCanCreateOperations, selectCanManageUsers, selectCanOpenSettings, selectCanEditPlanning, selectCurrentApplicationUser, selectSettingsMessage, selectSettingsUsers } from "../../state/settings/settings.selectors";
import { ApplicationUser, UserRole } from "../../types";
import { UsersSettingsComponent } from "./users-settings.component";

const user: ApplicationUser = {
  id: "7", uid: "auth-id", email: "agent@example.test", displayName: "Agent", role: 1,
  signatureName: "Agent", lastLoginAt: "",
};

describe("Profile administration permissions", () => {
  it.each([0, 1, 2, 3] as const)("RH access does not change base role %s permissions", role => {
    const profile = { ...user, role };
    expect(selectCanEditPlanning.projector({ ...profile, isRh: true })).toBe(selectCanEditPlanning.projector(profile));
    expect(selectCanCreateOperations.projector({ uid: user.uid }, [{ ...profile, isRh: true }]))
      .toBe(selectCanCreateOperations.projector({ uid: user.uid }, [profile]));
    expect(selectCanOpenSettings.projector({ uid: user.uid }, [{ ...profile, isRh: true }]))
      .toBe(selectCanOpenSettings.projector({ uid: user.uid }, [profile]));
  });
  it.each([[0, true], [1, false], [2, true], [3, true]] as const)("planning edit access for role %s is %s", (role, allowed) => {
    expect(selectCanEditPlanning.projector({ ...user, role })).toBe(allowed);
  });
  it("fails closed for absent profiles and resolves ownership from the session UUID", () => {
    expect(selectCanEditPlanning.projector(undefined)).toBe(false);
    expect(selectCurrentApplicationUser.projector(null, [user])).toBeUndefined();
    expect(selectCurrentApplicationUser.projector({ uid: 'other' }, [user])).toBeUndefined();
    expect(selectCurrentApplicationUser.projector({ uid: user.uid }, [user])).toBe(user);
  });
  it.each([[0, true], [1, false], [2, true], [3, true]] as const)("creation access for role %s is %s", (role, allowed) => {
    expect(selectCanCreateOperations.projector({ uid: user.uid }, [{ ...user, role }])).toBe(allowed);
  });
  it.each([[0, true], [1, false], [2, true], [3, true]] as const)("settings access for role %s is %s", (role, allowed) => {
    expect(selectCanOpenSettings.projector({ uid: user.uid }, [{ ...user, role }])).toBe(allowed);
  });

  it("hides settings until the current session has a known application profile", () => {
    expect(selectCanOpenSettings.projector(null, [{ ...user, role: 0 }])).toBe(false);
    expect(selectCanOpenSettings.projector({ uid: user.uid }, [])).toBe(false);
    expect(selectCanOpenSettings.projector({ uid: "other" }, [{ ...user, role: 0 }])).toBe(false);
  });
  it.each([1, 2, 3] as UserRole[])("does not grant administration to role %s", role => {
    expect(selectCanManageUsers.projector({ uid: user.uid }, [{ ...user, role }])).toBe(false);
  });

  it("requires a loaded admin profile belonging to the current session", () => {
    expect(selectCanManageUsers.projector(null, [{ ...user, role: 0 }])).toBe(false);
    expect(selectCanManageUsers.projector({ uid: user.uid }, [])).toBe(false);
    expect(selectCanManageUsers.projector({ uid: "other" }, [{ ...user, role: 0 }])).toBe(false);
    expect(selectCanManageUsers.projector({ uid: user.uid }, [{ ...user, role: 0 }])).toBe(true);
  });

  it.each([false, true])("guards global assignment controls when administration is %s", async allowed => {
    await TestBed.configureTestingModule({
      imports: [UsersSettingsComponent],
      providers: [provideNoopAnimations(), provideMockStore({ selectors: [
        { selector: selectAuthUser, value: { uid: user.uid } },
        { selector: selectSettingsUsers, value: [user] },
        { selector: selectSettingsMessage, value: null },
        { selector: selectCanManageUsers, value: allowed },
      ] })],
    }).compileComponents();
    const fixture = TestBed.createComponent(UsersSettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch");
    dispatch.mockClear();
    fixture.componentInstance.updateUserRole(user, 0);
    expect(fixture.componentInstance.canSaveAllAssignments()).toBe(allowed);
    fixture.componentInstance.saveAllAssignments();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.form-actions button').disabled).toBe(true);
    if (allowed) {
      expect(dispatch).toHaveBeenCalledWith(SettingsActions.userAssignmentsSaveRequested({ assignments: [{ userId: user.id, role: 0, directionId: null, isRh: false }] }));
      expect(fixture.nativeElement.querySelector("tbody button")).toBeNull();
    } else {
      expect(dispatch).not.toHaveBeenCalled();
    }
    fixture.destroy();
  });
});

it("propose uniquement les administrateurs, initiateurs et directeurs comme initiateurs", () => {
  const users = ([0, 1, 2, 3] as const).map(role => ({
    id: String(role), role, email: `role${role}@example.test`, displayName: `Profil ${role}`,
  }));
  expect(selectOperationInitiators.projector(users).map(user => user.role)).toEqual([0, 2, 3]);
});
