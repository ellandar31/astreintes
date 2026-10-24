import { Component, Input } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { provideMockStore } from "@ngrx/store/testing";
import { selectCanExportRh } from "../../state/settings/settings.selectors";
import { RhPageComponent } from "./rh-page.component";
import { RhExportsComponent } from "./rh-exports.component";

@Component({ selector: "app-rh-exports", standalone: true, template: "Exports" })
class ExportsStub { @Input() periodMode = false; @Input() userMode = false; }

describe("RH export navigation", () => {
  it("exposes operation, user and period exports without the consultation submenu", () => {
    TestBed.configureTestingModule({ imports: [RhPageComponent], providers: [
      provideNoopAnimations(), provideMockStore({ selectors: [{ selector: selectCanExportRh, value: true }] }),
    ] }).overrideComponent(RhPageComponent, {
      remove: { imports: [RhExportsComponent] }, add: { imports: [ExportsStub] },
    });
    const fixture = TestBed.createComponent(RhPageComponent);
    fixture.componentRef.setInput("user", null);
    fixture.detectChanges();
    expect(fixture.componentInstance.visibleSections().map(section => section.id)).toEqual(["exports", "userExports", "periodExports"]);
    expect(fixture.nativeElement.querySelector("app-history-page")).toBeNull();
    expect(fixture.nativeElement.querySelector("app-rh-exports")).not.toBeNull();
    fixture.componentInstance.setSection("periodExports");
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("app-rh-exports")).not.toBeNull();
  });
});
