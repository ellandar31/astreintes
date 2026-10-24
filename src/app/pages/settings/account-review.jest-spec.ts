import { APP_LABELS } from "../../i18n/labels";
import { NgForm } from "@angular/forms";
import { SettingsActions } from "../../state/settings/settings.actions";
import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { UsersSettingsComponent } from "./users-settings.component";
import { selectCanManageUsers, selectSettingsDirections, selectSettingsMessage, selectSettingsUsers } from "../../state/settings/settings.selectors";
import { ManagedUser } from "./settings.models";

const account: ManagedUser = {
  id: "7", email: "agent@example.fr", displayName: "Agent", role: 3,
  directionId: "2", createdAt: "2026-01-10T12:00:00Z",
  lastLoginAt: "2026-10-20T12:00:00Z", deletedAt: "2026-10-23T12:00:00Z",
};

describe("Read-only account review", () => {
  it("shows stored roles, directions and lifecycle dates without editing controls or write actions", () => {
    TestBed.configureTestingModule({
      imports: [UsersSettingsComponent], providers: [provideNoopAnimations(), provideMockStore({ selectors: [
        { selector: selectSettingsUsers, value: [account, { ...account, id: "8", createdAt: undefined, lastLoginAt: undefined, deletedAt: undefined }] },
        { selector: selectSettingsDirections, value: [{ id: "2", name: "DDH" }] },
        { selector: selectSettingsMessage, value: null },
        { selector: selectCanManageUsers, value: true },
      ] })],
    });
    const fixture = TestBed.createComponent(UsersSettingsComponent);
    fixture.componentRef.setInput("readOnly", true);
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("Directeur");
    expect(rows[0].textContent).not.toContain("DDH");
    expect(rows[0].querySelectorAll("td")).toHaveLength(6);
    const cells = rows[0].querySelectorAll("td");
    expect(cells[3].textContent.trim()).toBe("10/01/2026");
    expect(cells[4].textContent).toMatch(/20\/10\/2026 \d{2}:\d{2}/);
    expect(cells[5].textContent.trim()).toBe("23/10/2026");
    for (const date of ["10/01/2026", "20/10/2026", "23/10/2026"]) expect(rows[0].textContent).toContain(date);
    expect(Array.from(rows[1].querySelectorAll("td")).slice(-3).map(cell => (cell as HTMLElement).textContent?.trim())).toEqual(Array(3).fill(APP_LABELS.common.empty.dash));
    expect(fixture.nativeElement.querySelector("tbody p-select, tbody p-checkbox, tbody button")).toBeNull();
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch");
    dispatch.mockClear();
    fixture.componentInstance.updateUserRole(account, 0);
    fixture.componentInstance.updateUserDirection(account, null);
    fixture.componentInstance.updateUserRh(account, true);
    fixture.componentInstance.saveAllAssignments();
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("allows preparation and permanent deletion actions while keeping review fields read-only", () => {
    TestBed.configureTestingModule({ imports: [UsersSettingsComponent], providers: [provideNoopAnimations(), provideMockStore({ selectors: [
      { selector: selectSettingsUsers, value: [{ ...account, deletedAt: undefined }] },
      { selector: selectSettingsDirections, value: [{ id: "2", name: "DDH" }] },
      { selector: selectSettingsMessage, value: null },
      { selector: selectCanManageUsers, value: true },
    ] })] });
    const fixture = TestBed.createComponent(UsersSettingsComponent);
    fixture.componentRef.setInput("readOnly", true);
    fixture.componentRef.setInput("allowAccountActions", true);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector("form .ng-invalid")).toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="accountTrigram"]').hasAttribute("maxlength")).toBe(false);
    expect(fixture.nativeElement.querySelector("tbody .pi-trash")).not.toBeNull();
    expect(fixture.nativeElement.querySelector("tbody p-select")).toBeNull();
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch"); dispatch.mockClear();
    component.removeAccount({ ...account, deletedAt: undefined });
    expect(dispatch).toHaveBeenCalledWith(SettingsActions.userDeleteRequested({ userId: account.id }));
    dispatch.mockClear(); component.removeAccount(account);
    expect(dispatch).toHaveBeenCalledWith(SettingsActions.userDeleteRequested({ userId: account.id }));
    dispatch.mockClear();
    expect(fixture.nativeElement.querySelector('input[name="accountEmail"]')).not.toBeNull();
    expect(Array.from(fixture.nativeElement.querySelectorAll("form input")).map(input => (input as HTMLInputElement).name))
      .toEqual(["accountTrigram", "accountName", "accountEmail"]);
    expect(fixture.nativeElement.querySelector("form p-select, form p-checkbox")).toBeNull();
    component.newAccount = { email: "future@example.fr", displayName: "Future", trigram: "LONGCODE" };
    const validForm = { invalid: false } as NgForm;
    component.createAccount(validForm);
    expect(dispatch).toHaveBeenCalledWith(SettingsActions.userCreateRequested({
      user: { ...component.newAccount, role: 1, directionId: null, isRh: false },
    }));
    dispatch.mockClear(); component.createAccount(validForm);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("saves every modified row together and blocks the whole save if a direction is missing", () => {
    const first = { ...account, role: 1 as const, directionId: null, deletedAt: undefined };
    const second = { ...first, id: "8" };
    TestBed.configureTestingModule({ imports: [UsersSettingsComponent], providers: [provideNoopAnimations(), provideMockStore({ selectors: [
      { selector: selectSettingsUsers, value: [first, second] },
      { selector: selectSettingsDirections, value: [{ id: "2", name: "DDH" }] },
      { selector: selectSettingsMessage, value: null },
      { selector: selectCanManageUsers, value: true },
    ] })] });
    const fixture = TestBed.createComponent(UsersSettingsComponent); fixture.detectChanges();
    const component = fixture.componentInstance;
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch"); dispatch.mockClear();
    component.updateUserRole(first, 3);
    component.updateUserRh(second, true);
    component.saveAllAssignments();
    expect(dispatch).not.toHaveBeenCalled();
    component.updateUserDirection(first, "2"); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll("tbody button")).toHaveLength(0);
    expect(fixture.nativeElement.querySelectorAll(".form-actions button")).toHaveLength(1);
    component.saveAllAssignments();
    expect(dispatch).toHaveBeenCalledWith(SettingsActions.userAssignmentsSaveRequested({ assignments: [
      { userId: first.id, role: 3, directionId: "2", isRh: false },
      { userId: second.id, role: 1, directionId: null, isRh: true },
    ] }));
    dispatch.mockClear(); component.saveAllAssignments();
    expect(dispatch).not.toHaveBeenCalled();
  });

});
