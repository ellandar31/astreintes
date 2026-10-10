import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { provideMockStore } from "@ngrx/store/testing";
import { selectExceptionalOperations } from "../../state/exceptional/exceptional.selectors";
import { selectRegularInterventions, selectRegularPeriods, selectRegularPublicHolidays } from "../../state/regular/regular.selectors";
import { selectSettingsRhCompensation, selectSettingsRhGenerationApiUrl, selectSettingsRhTemplates } from "../../state/settings/settings.selectors";
import { RhExportsComponent } from "./rh-exports.component";
import { RhPeriodExcelExportLibrary } from "./export-libraries/rh-period-excel-export.lib";
import { APP_LABELS } from "../../i18n/labels";

describe("RH period export UI", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RhExportsComponent], providers: [
      provideNoopAnimations(), provideMockStore({ selectors: [
        { selector: selectRegularPeriods, value: [] },
        { selector: selectRegularInterventions, value: [] },
        { selector: selectRegularPublicHolidays, value: [] },
        { selector: selectExceptionalOperations, value: [] },
        { selector: selectSettingsRhCompensation, value: null },
        { selector: selectSettingsRhGenerationApiUrl, value: "" },
        { selector: selectSettingsRhTemplates, value: [] },
      ] }),
    ] }).compileComponents();
  });

  it("renders inclusive submission bounds and disables invalid periods", () => {
    const fixture = TestBed.createComponent(RhExportsComponent);
    fixture.componentRef.setInput("periodMode", true);
    fixture.componentInstance.periodStart = "2026-10-31";
    fixture.componentInstance.periodEnd = "2026-10-01";
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('input[type="date"]')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('input[type="month"]')).toBeNull();
    expect(fixture.nativeElement.querySelector("p-button button").disabled).toBe(true);
  });

  it("includes old execution dates and excludes unsent operations", async () => {
    const fixture = TestBed.createComponent(RhExportsComponent);
    fixture.componentRef.setInput("periodMode", true);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.periodStart = "2026-10-01";
    page.periodEnd = "2026-10-31";
    page.selectedMonth = "2026-10";
    page.regularPeriods = [{ id: "1", userId: "1", userName: "Agent", userEmail: "agent@example.fr",
      startDate: "2026-07-06T18:00", endDate: "2026-07-06T20:00", sentToRhAt: "2026-10-02T10:00" }];
    expect(page.exportRows("regular")).toHaveLength(0);
    expect(page.periodOperationCount("regular")).toBe(1);
    page.regularPeriods = page.regularPeriods.map(item => ({ ...item, sentToRhAt: undefined }));
    const build = jest.spyOn(RhPeriodExcelExportLibrary.prototype, "buildWorkbook");
    await page.exportExcelPeriod();
    expect(build).not.toHaveBeenCalled();
    expect(page.exportMessage).toBe(APP_LABELS.rhDocuments.periodExport.empty);
    build.mockRestore();
  });

  it("reports generation failures and releases the busy state", async () => {
    const fixture = TestBed.createComponent(RhExportsComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.periodStart = "2026-10-01";
    page.periodEnd = "2026-10-31";
    page.regularPeriods = [{ id: "1", userId: "1", userName: "Agent", userEmail: "agent@example.fr",
      startDate: "2026-07-06T18:00", endDate: "2026-07-06T20:00", sentToRhAt: "2026-10-02T10:00" }];
    const build = jest.spyOn(RhPeriodExcelExportLibrary.prototype, "buildWorkbook").mockRejectedValue(new Error("Failed"));
    await page.exportExcelPeriod();
    expect(page.exportingPeriod).toBe(false);
    expect(page.exportMessage).toBe(APP_LABELS.rhDocuments.periodExport.failure);
    build.mockRestore();
  });
});
