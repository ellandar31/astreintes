import { By } from "@angular/platform-browser";
import { Table } from "primeng/table";
import { TestBed, fakeAsync, tick } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { selectExceptionalOperations } from "../../state/exceptional/exceptional.selectors";
import { selectRegularInterventions, selectRegularPeriods, selectRegularPublicHolidays } from "../../state/regular/regular.selectors";
import { selectCanExportRh, selectSettingsRhCompensation, selectSettingsState } from "../../state/settings/settings.selectors";
import { RhExportsComponent } from "./rh-exports.component";
import { RhExcelExportLibrary } from "./export-libraries/rh-excel-export.lib";
import { RH_EXCEL_MIME, RhPeriodExcelExportLibrary } from "./export-libraries/rh-period-excel-export.lib";
import { initialSettingsState } from "../../state/settings/settings.reducer";
import { SettingsActions } from "../../state/settings/settings.actions";
import { APP_LABELS } from "../../i18n/labels";

describe("RH period export UI", () => {
  it.each(["regular", "exceptionalOnCall", "exceptionalWork"] as const)("shows only submitted %s operations and rejects exports after cancellation", template => {
    const fixture = TestBed.createComponent(RhExportsComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.selectedMonth = "2026-10";
    const dates = { startDate: "2026-10-01T18:00", endDate: "2026-10-02T08:00" };
    page.regularPeriods = [
      { id: "1", userId: "7", userName: "Agent", userEmail: "agent@test.fr", ...dates },
      { id: "2", userId: "7", userName: "Agent", userEmail: "agent@test.fr", ...dates, sentToRhAt: "2026-10-03T10:00" },
      { id: "3", userId: "7", userName: "Agent", userEmail: "agent@test.fr", ...dates, sentToRhAt: "2026-10-03T10:00", treatedAt: "2026-10-04T10:00" },
    ];
    const type = template === "exceptionalWork" ? "travaux" : "astreinte";
    const operation = { type, initiatorName: "Agent", operationManagerName: "Agent", title: "Operation",
      startDate: dates.startDate, forecastEndDate: dates.endDate, actualStartDate: dates.startDate,
      actualEndDate: dates.endDate, plannedUsers: [], actualUsers: [], interventions: [] };
    page.exceptionalOperations = [
      { ...operation, id: `${type}:1` },
      { ...operation, id: `${type}:2`, sentToRhAt: "2026-10-03T10:00" },
      { ...operation, id: `${type}:3`, sentToRhAt: "2026-10-03T10:00", treatedAt: "2026-10-04T10:00" },
    ];
    const rows = page.exportRows(template);
    expect(rows.map(row => row.sourceId)).toEqual(template === "regular" ? ["2", "3"] : [`${type}:2`, `${type}:3`]);
    const stale = rows[0];
    page.regularPeriods = page.regularPeriods.map(row => row.id === stale.sourceId ? { ...row, sentToRhAt: undefined } : row);
    page.exceptionalOperations = page.exceptionalOperations.map(row => row.id === stale.sourceId ? { ...row, sentToRhAt: undefined } : row);
    expect(page.exportRows(template)).toHaveLength(1);
    const create = jest.spyOn(document, "createElement");
    page.exportExcelOperation(template, stale);
    expect(create).not.toHaveBeenCalled();
    create.mockRestore();
  });

  it.each(["regular", "exceptionalOnCall", "exceptionalWork"] as const)("filters %s user exports across months using all participant sources", template => {
    const fixture = TestBed.createComponent(RhExportsComponent);
    fixture.componentRef.setInput("userMode", true);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.selectedMonth = "2026-10";
    const dates = { startDate: "2026-01-01T18:00", endDate: "2026-01-02T08:00" };
    page.regularPeriods = [
      { id: "old", userId: "7", userName: "Agent", userEmail: "agent@test.fr", ...dates, sentToRhAt: "2026-02-01" },
      { id: "other", userId: "8", userName: "Other", userEmail: "other@test.fr", ...dates, sentToRhAt: "2026-02-01" },
      { id: "unsent", userId: "9", userName: "Unsent", userEmail: "unsent@test.fr", ...dates },
    ];
    const operation = { type: template === "exceptionalWork" ? "travaux" : "astreinte",
      title: "Operation", initiatorName: "Initiator", operationManagerName: "Manager",
      startDate: dates.startDate, forecastEndDate: dates.endDate, plannedUsers: [], actualUsers: [], interventions: [] };
    const participant = { userId: "7", displayName: "Agent", email: "agent@test.fr", ...dates };
    page.exceptionalOperations = [
      { ...operation, id: "planned", plannedUsers: [participant], sentToRhAt: "2026-02-01" },
      { ...operation, id: "actual", actualUsers: [participant], sentToRhAt: "2026-02-01" },
      { ...operation, id: "intervention", interventions: [{ id: "i", userId: "7", userName: "Agent", userEmail: "agent@test.fr", ...dates }], sentToRhAt: "2026-02-01" },
      { ...operation, id: "unsent", plannedUsers: [{ ...participant, userId: "9" }] },
    ];
    expect(page.exportRows(template)).toEqual([]);
    page.selectedUserId = "7";
    expect(page.exportRows(template).map(row => row.sourceId)).toEqual(template === "regular" ? ["old"] : ["planned", "actual", "intervention"]);
    expect(page.exportUsers.filter(item => item.id === "7")).toEqual([{ id: "7", label: "Agent - (agent@test.fr)" }]);
    expect(page.exportUsers.some(item => item.id === "9")).toBe(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[type="month"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('p-select')).not.toBeNull();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RhExportsComponent], providers: [
      provideNoopAnimations(), provideMockStore({ selectors: [
        { selector: selectCanExportRh, value: true },
        { selector: selectRegularPeriods, value: [] },
        { selector: selectRegularInterventions, value: [] },
        { selector: selectRegularPublicHolidays, value: [] },
        { selector: selectExceptionalOperations, value: [] },
        { selector: selectSettingsRhCompensation, value: null },
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

  it("previews only operations included in the workbook and places download beside dates", () => {
    const fixture = TestBed.createComponent(RhExportsComponent);
    fixture.componentRef.setInput("periodMode", true);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.periodStart = "2026-10-01";
    page.periodEnd = "2026-10-31";
    const operation = { userId: "7", userName: "Agent", userEmail: "agent@test.fr",
      startDate: "2026-01-01T18:00", endDate: "2026-01-02T08:00" };
    page.regularPeriods = [
      { ...operation, id: "included", sentToRhAt: "2026-10-15T10:00", treatedAt: "2026-10-16T10:00" },
      { ...operation, id: "outside", sentToRhAt: "2026-09-15T10:00" },
      { ...operation, id: "unsent" },
    ];
    expect(page.periodExportRows().map(row => row.operation.sourceId)).toEqual(["included"]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll(".rh-period-fields input[type=date]")).toHaveLength(2);
    expect(fixture.nativeElement.querySelector(".rh-period-fields p-button")).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll("p-table tbody tr")).toHaveLength(1);
    page.periodEnd = "2026-10-10";
    expect(page.periodExportRows()).toEqual([]);
    page.periodEnd = "2026-10-31";
    page.regularPeriods = page.regularPeriods.map(row => ({ ...row, sentToRhAt: undefined }));
    expect(page.periodExportRows()).toEqual([]);
  });

  it("treats only selected current submissions and supports cancellation", () => {
    const fixture = TestBed.createComponent(RhExportsComponent);
    fixture.componentRef.setInput("periodMode", true);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.periodStart = "2026-10-01";
    page.periodEnd = "2026-10-31";
    const operation = { userId: "7", userName: "Agent", userEmail: "agent@test.fr",
      startDate: "2026-01-01T18:00", endDate: "2026-01-02T08:00", sentToRhAt: "2026-10-15T10:00" };
    page.regularPeriods = [
      { ...operation, id: "1" },
      { ...operation, id: "2", treatedAt: "2026-10-16T10:00" },
      { ...operation, id: "3", sentToRhAt: undefined },
    ];
    page.selectedOperationKeys = new Set(["regularOnCallPeriods:1", "regularOnCallPeriods:2", "regularOnCallPeriods:3"]);
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch");
    expect(page.selectedUntreatedCount).toBe(1);
    page.updateTreatment(true);
    expect(dispatch).toHaveBeenLastCalledWith(SettingsActions.rhTreatmentRequested({ operations: [{ type: "regular", id: "1" }], treated: true }));
    const treated = page.periodExportRows()[1].operation;
    page.updateTreatment(false, treated);
    expect(dispatch).toHaveBeenLastCalledWith(SettingsActions.rhTreatmentRequested({ operations: [{ type: "regular", id: "2" }], treated: false }));
    dispatch.mockClear();
    page.regularPeriods = [];
    page.updateTreatment(false, treated);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("reuses preview rows between renders and paginates without excluding operations from exports", () => {
    const fixture = TestBed.createComponent(RhExportsComponent);
    fixture.componentRef.setInput("periodMode", true);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.periodStart = "2026-10-01";
    page.periodEnd = "2026-10-31";
    page.regularPeriods = Array.from({ length: 80 }, (_, index) => ({
      id: String(index), userId: "7", userName: "Agent", userEmail: "agent@test.fr",
      startDate: "2026-01-01T18:00", endDate: "2026-01-02T08:00", sentToRhAt: "2026-10-15T10:00",
    }));
    const operations = page.periodOperations();
    const rows = page.periodExportRows();
    expect(rows).toHaveLength(80);
    expect(page.periodOperationCount("regular")).toBe(80);
    expect(page.periodOperations()).toBe(operations);
    expect(page.periodExportRows()).toBe(rows);
    expect(page.exportUsers).toBe(page.exportUsers);
    fixture.detectChanges();
    fixture.detectChanges();
    expect(page.periodExportRows()).toBe(rows);
    expect(fixture.nativeElement.querySelectorAll("p-table tbody tr")).toHaveLength(25);
    expect(page.periodOperations().regular).toHaveLength(80);
    page.periodEnd = "2026-10-10";
    expect(page.periodExportRows()).toHaveLength(0);
    expect(page.periodOperations()).toBe(operations);
    page.periodEnd = "2026-10-31";
    page.regularPeriods = page.regularPeriods.map(row => row.id === "0" ? { ...row, sentToRhAt: undefined } : row);
    expect(page.periodExportRows()).toHaveLength(79);
    expect(page.periodOperations()).not.toBe(operations);
  });

  it("uses profile trigrams, names and emails for regular and exceptional export participants", () => {
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectSettingsState, { ...initialSettingsState, users: [{
      id: "7", uid: "auth-agent", role: 1, trigram: "ABC", displayName: "Agent Test", email: "agent@test.fr",
    }] });
    const fixture = TestBed.createComponent(RhExportsComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    const dates = { startDate: "2026-10-01T18:00", endDate: "2026-10-02T08:00" };
    page.regularPeriods = [{ id: "1", userId: "7", userName: "Agent", userEmail: "old@test.fr", ...dates }];
    page.regularInterventions = [{ id: "i", periodId: "1", userId: "7", userName: "Agent", userEmail: "old@test.fr", ...dates }];
    page.exceptionalOperations = [{ id: "astreinte:1", type: "astreinte", title: "Test", initiatorUid: "7",
      initiatorName: "Agent", operationManagerUid: "7", operationManagerName: "Agent", ...dates,
      forecastEndDate: dates.endDate, actualStartDate: dates.startDate, actualEndDate: dates.endDate,
      plannedUsers: [{ userId: "7", displayName: "Agent", email: "old@test.fr", ...dates }],
      actualUsers: [{ userId: "7", displayName: "Agent", email: "old@test.fr", ...dates }],
      interventions: [{ userId: "7", userName: "Agent", userEmail: "old@test.fr", ...dates }],
    }];
    const expected = "ABC - Agent Test - (agent@test.fr)";
    const operations = page.periodOperations();
    expect(operations.regular[0].actualUsers[0].name).toBe(expected);
    expect(operations.regular[0].interventions[0].userName).toBe(expected);
    const exceptional = operations.exceptionalOnCall[0];
    expect(exceptional.plannedUsers[0].name).toBe(expected);
    expect(exceptional.actualUsers[0].name).toBe(expected);
    expect(exceptional.interventions[0].userName).toBe(expected);
    expect(exceptional.title).toBe("Test");
    expect(operations.regular[0].title).toBe(`${APP_LABELS.rh.controls.types.regularOnCall} - Agent`);
    expect(exceptional.initiatorName).toBe("Agent");
    expect(exceptional.operationManagerName).toBe("Agent");
  });

  it.each(["download", "cancel", "revoke", "failure"] as const)("handles individual XLSX generation: %s", async scenario => {
    const fixture = TestBed.createComponent(RhExportsComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.selectedMonth = "2026-10";
    page.regularPeriods = [{ id: "1", userId: "7", userName: "Agent", userEmail: "agent@test.fr",
      startDate: "2026-10-01T18:00", endDate: "2026-10-02T08:00", sentToRhAt: "2026-10-03T10:00" }];
    const operation = page.exportRows("regular")[0];
    const bytes = new Uint8Array([0x50, 0x4b]);
    let finish: (value: Uint8Array) => void = () => undefined;
    let reject: (error: Error) => void = () => undefined;
    const build = jest.spyOn(RhExcelExportLibrary.prototype, "buildWorkbook").mockImplementation(() =>
      new Promise<Uint8Array>((resolve, fail) => { finish = resolve; reject = fail; }));
    const download = jest.spyOn(page as unknown as { downloadBlob(filename: string, blob: Blob): void }, "downloadBlob")
      .mockImplementation(() => undefined);
    try {
      const pending = page.exportExcelOperation("regular", operation);
      expect(page.exportingOperationKey).not.toBeNull();
      await page.exportExcelOperation("regular", operation);
      expect(build).toHaveBeenCalledTimes(1);
      if (scenario === "cancel") page.regularPeriods = [{ ...page.regularPeriods[0], sentToRhAt: undefined }];
      if (scenario === "revoke") {
        const store = TestBed.inject(MockStore);
        store.overrideSelector(selectCanExportRh, false);
        store.refreshState();
      }
      if (scenario === "failure") reject(new Error("Generation failed"));
      else finish(bytes);
      await pending;
      expect(page.exportingOperationKey).toBeNull();
      if (scenario === "download") {
        expect(download).toHaveBeenCalledWith(expect.stringMatching(/\.xlsx$/), expect.any(Blob));
        expect(download.mock.calls[0][1].type).toBe(RH_EXCEL_MIME);
        expect(page.exportMessage).toContain(operation.title);
      } else {
        expect(download).not.toHaveBeenCalled();
        if (scenario === "failure") expect(page.exportMessage).toBe(APP_LABELS.rh.exports.messages.excelFailed);
      }
    } finally { build.mockRestore(); download.mockRestore(); }
  });

  it("sorts submission dates chronologically and combines header filters without changing export scope", fakeAsync(() => {
    const fixture = TestBed.createComponent(RhExportsComponent);
    fixture.componentRef.setInput("periodMode", true);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.periodStart = "2026-10-01";
    page.periodEnd = "2026-10-31";
    const period = { userId: "7", userEmail: "agent@test.fr", startDate: "2026-10-01T18:00", endDate: "2026-10-02T08:00" };
    page.regularPeriods = [
      { ...period, id: "1", userName: "Zeta", sentToRhAt: "2026-10-09T10:00" },
      { ...period, id: "2", userName: "Alpha", sentToRhAt: "2026-10-02T10:00" },
    ];
    fixture.detectChanges();
    const table = fixture.debugElement.query(By.directive(Table)).componentInstance as Table;
    expect(fixture.nativeElement.querySelectorAll("p-columnfilter")).toHaveLength(5);
    const headers = fixture.nativeElement.querySelectorAll("thead th");
    headers[4].click();
    fixture.detectChanges();
    expect(table.value.map(row => row.operation.sourceId)).toEqual(["2", "1"]);
    headers[4].click();
    fixture.detectChanges();
    expect(table.value.map(row => row.operation.sourceId)).toEqual(["1", "2"]);
    table.filterDelay = 0;
    table.filter("Alpha", "operation.title", "contains");
    tick(1);
    fixture.detectChanges();
    expect(table.filteredValue?.map(row => row.operation.sourceId)).toEqual(["2"]);
    table.filter(new Date("2026-10-09T10:00"), "sentDate", "dateIs");
    tick(1);
    fixture.detectChanges();
    expect(table.filteredValue).toEqual([]);
    expect(page.periodOperations().regular).toHaveLength(2);
  }));

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

  it.each([0, 1, 2, 3] as const)("grants exports only through the RH flag for base role %s", role => {
    const user = { id: '7', uid: 'auth-id', email: 'agent@test.fr', displayName: 'Agent', role, signatureName: '' };
    expect(selectCanExportRh.projector({ ...user, isRh: false })).toBe(false);
    expect(selectCanExportRh.projector({ ...user, isRh: true })).toBe(true);
    expect(selectCanExportRh.projector({ ...user, isRh: true, deletedAt: '2099-01-01' })).toBe(false);
  });

  it.each([false, true])("masque le mode période %s et refuse tous les exports après révocation", async periodMode => {
    const fixture = TestBed.createComponent(RhExportsComponent);
    fixture.componentRef.setInput('periodMode', periodMode);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.selectedMonth = '2026-10';
    page.regularPeriods = [{ id: '1', userId: '7', userName: 'Agent', userEmail: 'agent@example.test',
      startDate: '2026-10-01T18:00', endDate: '2026-10-02T08:00', sentToRhAt: '2026-10-03T10:00' }];
    const operation = page.exportRows('regular')[0];
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectCanExportRh, false);
    store.refreshState();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('p-card')).toBeNull();
    const create = jest.spyOn(document, 'createElement');
    const dispatch = jest.spyOn(store, 'dispatch').mockClear();
    page.exportExcelOperation('regular', operation);
    await page.exportExcelPeriod();
    expect(create).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    create.mockRestore();
  });

  it("refuse les exports tant que le profil n'est pas chargé", () => {
    expect(selectCanExportRh.projector(undefined)).toBe(false);
  });
});
