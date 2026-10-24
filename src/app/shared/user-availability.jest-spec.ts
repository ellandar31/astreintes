import { OperationModalComponent } from "../pages/exceptional-common/operation-modal.component";
import { RegularPeriodModalComponent } from "../pages/regular/regular-period-modal.component";
import { isUserAssignable } from "./user-availability";

describe("Assignment availability", () => {
  const active = { id: "1", email: "active@test.fr", displayName: "Active", deletedAt: null };
  const departed = { id: "2", email: "departed@test.fr", displayName: "Departed", deletedAt: "2099-01-01" };

  it("accepts empty departure dates and rejects every populated date", () => {
    expect(isUserAssignable(active)).toBe(true);
    expect(isUserAssignable({ deletedAt: null })).toBe(true);
    expect(isUserAssignable(departed)).toBe(false);
  });

  it("excludes departed users from regular choices without discarding the directory", () => {
    const modal = new RegularPeriodModalComponent();
    modal.users = [active, departed];
    expect(modal.assignableUsers).toEqual([active]);
    modal.selectUser(departed.id);
    expect(modal.form.userId).toBe("");
    expect(modal.users).toContain(departed);
  });

  it("blocks departed participants and initiators, including stale selections", () => {
    const modal = new OperationModalComponent();
    modal.users = [active, departed];
    modal.initiatorUsers = [active, departed];
    expect(modal.availableUsers()).toEqual([active]);
    expect(modal.assignableInitiators).toEqual([active]);
    modal.addParticipant("plannedUsers", departed.id);
    modal.selectInitiator(departed.id);
    expect(modal.form.plannedUsers).toEqual([]);
    expect(modal.form.initiatorUid).toBe("");
  });
});
