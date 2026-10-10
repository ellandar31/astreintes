import { CommonModule } from "@angular/common";
import { CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { MessageModule } from "primeng/message";
import { APP_LABELS } from "../../i18n/labels";
import { selectCanManageUsers } from "../../state/settings/settings.selectors";
import { SettingsSection } from "./settings.models";
import { SettingsPageComponent } from "./settings-page.component";

const adminSections: SettingsSection[] = ["users", "holidays", "rhCompensation"];

describe("Settings page visibility", () => {
  async function createPage(admin: boolean) {
    await TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [provideNoopAnimations(), provideMockStore({ selectors: [
        { selector: selectCanManageUsers, value: admin },
      ] })],
    }).overrideComponent(SettingsPageComponent, {
      // Isolate navigation from each child's persistence subscriptions.
      set: { imports: [CommonModule, ButtonModule, CardModule, MessageModule], schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    }).compileComponents();
    const fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it("shows only teams for a non-admin or a profile not loaded yet", async () => {
    const fixture = await createPage(false);
    expect(fixture.componentInstance.sections().map(section => section.id)).toEqual(["teams"]);
    expect(fixture.nativeElement.querySelectorAll('.settings-menu-button')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain(APP_LABELS.settings.menu.teams);
    expect(fixture.nativeElement.querySelector('app-teams-settings')).not.toBeNull();
    for (const section of adminSections) {
      fixture.componentInstance.setSection(section);
      fixture.detectChanges();
      expect(fixture.componentInstance.activeSection).toBe("teams");
    }
    expect(fixture.nativeElement.querySelector('app-users-settings')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-holidays-settings')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-rh-compensation-settings')).toBeNull();
  });

  it("keeps every settings section available to an administrator", async () => {
    const fixture = await createPage(true);
    expect(fixture.componentInstance.sections()).toHaveLength(4);
    expect(fixture.nativeElement.querySelector('app-users-settings')).not.toBeNull();
    for (const section of [...adminSections, "teams"] as SettingsSection[]) {
      fixture.componentInstance.setSection(section);
      fixture.detectChanges();
      expect(fixture.componentInstance.activeSection).toBe(section);
    }
  });

  it.each(adminSections)("unmounts %s immediately when admin privileges are revoked", async section => {
    const fixture = await createPage(true);
    fixture.componentInstance.setSection(section);
    fixture.componentInstance.showSuccess("Administrative message");
    fixture.detectChanges();
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectCanManageUsers, false);
    store.refreshState();
    fixture.detectChanges();
    expect(fixture.componentInstance.activeSection).toBe("teams");
    expect(fixture.componentInstance.settingsSuccess).toBe("");
    expect(fixture.nativeElement.querySelector('app-teams-settings')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.settings-menu-button')).toHaveLength(1);
  });
});
