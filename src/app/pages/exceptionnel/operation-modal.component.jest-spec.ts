import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { OperationModalComponent } from "./operation-modal.component";

/** Regression: readonly initiators must keep their hover tooltip without allowing edits. */
describe("OperationModalComponent readonly initiator", () => {
  afterEach(() => jest.restoreAllMocks());

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
    const label = fixture.nativeElement.querySelector("app-truncated-text span");
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
