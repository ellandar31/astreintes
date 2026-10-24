import { createEmptyVisa } from "../../shared/visa.models";
import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { OperationModalComponent } from "./operation-modal.component";

/** Regression: readonly initiators must keep their hover tooltip without allowing edits. */
describe("OperationModalComponent readonly initiator", () => {
  afterEach(() => jest.restoreAllMocks());

  it("keeps intervention actions attached to the original row after table sorting", async () => {
    await TestBed.configureTestingModule({ imports: [OperationModalComponent], providers: [provideNoopAnimations()] }).compileComponents();
    const fixture = TestBed.createComponent(OperationModalComponent);
    const visa = createEmptyVisa();
    const intervention = { userId: "7", userEmail: "agent@test.fr", startDate: "2026-10-01T18:00", endDate: "2026-10-01T19:00",
      label: "", wasOnSite: false, agentVisa: visa };
    const interventions = [{ ...intervention, id: "1", userName: "Zeta" }, { ...intervention, id: "2", userName: "Alpha" }];
    const operation = { id: "astreinte:1", type: "astreinte", initiatorUid: "7", initiatorName: "Agent", operationManagerName: "Agent", title: "Test",
      startDate: intervention.startDate, forecastEndDate: intervention.endDate,
      actualStartDate: intervention.startDate, actualEndDate: intervention.endDate,
      plannedUsers: [], actualUsers: [], interventions, visas: { initiatorGlobal: visa, directorGlobal: visa } };
    fixture.componentRef.setInput("operation", operation);
    fixture.detectChanges();
    const originalOrder = [...interventions];
    fixture.nativeElement.querySelector("thead th").click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("tbody tr td").textContent).toContain("Alpha");
    const remove = jest.spyOn(fixture.componentInstance.deleteIntervention, "emit");
    const rowButtons = fixture.nativeElement.querySelectorAll("tbody tr:first-child p-button button");
    rowButtons[1].click();
    expect(remove).toHaveBeenCalledWith({ operation, index: 1 });
    expect(interventions).toEqual(originalOrder);
  });

  it.each(["isLocked", "planningReadOnly"] as const)("shows the full clipped name with %s", async (readonlyInput) => {
    await TestBed.configureTestingModule({
      imports: [OperationModalComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
    // jsdom has no layout; model the measured overflow of a long selected name.
    jest.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(400);
    jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    const fixture = TestBed.createComponent(OperationModalComponent);
    const user = { id: "7", displayName: "Manager ou Initiateur avec un nom très long", email: "init@example.fr" };
    fixture.componentRef.setInput("initiatorUsers", [user]);
    fixture.componentRef.setInput(readonlyInput, true);
    fixture.componentRef.setInput("form", { ...fixture.componentInstance.form, initiatorUid: user.id });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector("#operation-initiator");
    const label = fixture.nativeElement.querySelector("#operation-initiator app-truncated-text span");
    expect(label).not.toBeNull();
    label.dispatchEvent(new MouseEvent("mouseenter"));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.body.querySelector(".p-tooltip-text")?.textContent).toContain(user.displayName);

    select.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    select.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowDown", bubbles: true }));
    fixture.detectChanges();
    expect(document.body.querySelector(".p-select-overlay")).toBeNull();
    expect(fixture.componentInstance.form.initiatorUid).toBe(user.id);
    label.dispatchEvent(new MouseEvent("mouseleave"));
    fixture.destroy();
  });
});
