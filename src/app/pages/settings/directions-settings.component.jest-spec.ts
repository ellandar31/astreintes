import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { NgForm } from "@angular/forms";
import { DirectionsSettingsComponent } from "./directions-settings.component";
import { UsersSettingsComponent } from "./users-settings.component";
import { SettingsActions } from "../../state/settings/settings.actions";
import { selectCanManageUsers, selectSettingsDirections, selectSettingsMessage, selectSettingsUsers } from "../../state/settings/settings.selectors";
import { ManagedUser } from "../../types";

const user: ManagedUser = { id: "7", email: "agent@test.fr", displayName: "Agent", role: 1 };
const direction = { id: "1", name: "Direction technique" };

describe("Directions administration", () => {
  it.each([true, false])("only admins can stage and save RH access independently: %s", async allowed => {
    await setup(allowed);
    const fixture = TestBed.createComponent(UsersSettingsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch").mockClear();
    expect(component.roles.map(role => role.value)).toEqual([0, 1, 2, 3]);
    component.updateUserRh(user, true);
    expect(dispatch).not.toHaveBeenCalled();
    expect(component.roleFor(user)).toBe(1);
    component.saveAllAssignments();
    if (allowed) expect(dispatch).toHaveBeenCalledWith(SettingsActions.userAssignmentsSaveRequested({ assignments: [{
      userId: user.id, role: 1, directionId: null, isRh: true,
    }] }));
    else expect(dispatch).not.toHaveBeenCalled();
  });

  async function setup(allowed: boolean) {
    await TestBed.configureTestingModule({
      imports: [DirectionsSettingsComponent, UsersSettingsComponent],
      providers: [provideNoopAnimations(), provideMockStore({ selectors: [
        { selector: selectCanManageUsers, value: allowed },
        { selector: selectSettingsDirections, value: [direction] },
        { selector: selectSettingsUsers, value: [user] },
        { selector: selectSettingsMessage, value: null },
      ] })],
    }).compileComponents();
  }

  it.each([false, true])("guards reference CRUD when admin permission is %s", async allowed => {
    await setup(allowed);
    const fixture = TestBed.createComponent(DirectionsSettingsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch").mockClear();
    component.name = "  Direction technique  ";
    component.save({ invalid: false } as NgForm);
    component.remove(direction);
    expect(dispatch).toHaveBeenCalledTimes(allowed ? 2 : 0);
    if (allowed) expect(dispatch).toHaveBeenCalledWith(SettingsActions.directionSaveRequested({ directionId: null, name: direction.name }));
    expect(fixture.nativeElement.textContent).toContain(direction.name);
  });

  it.each([2, 3] as const)("saves role %s and its required direction atomically", async role => {
    await setup(true);
    const fixture = TestBed.createComponent(UsersSettingsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch").mockClear();
    component.updateUserRole(user, role);
    expect(dispatch).not.toHaveBeenCalled();
    expect(component.roleFor(user)).toBe(role);
    component.updateUserDirection(user, direction.id);
    expect(dispatch).not.toHaveBeenCalled();
    component.saveAllAssignments();
    expect(dispatch).toHaveBeenCalledWith(SettingsActions.userAssignmentsSaveRequested({ assignments: [{ userId: user.id, role, directionId: direction.id, isRh: false }] }));
    dispatch.mockClear();
    component.updateUserDirection({ ...user, role, directionId: direction.id, isRh: false }, null);
    component.saveAllAssignments();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
