import { ExportOperation, RhExportContext } from "./rh-export.models";
import { RhExcelExportLibrary } from "./rh-excel-export.lib";

function operationFixture(): ExportOperation {
  const unsignedVisa = { signed: false, signedAt: "", signedByName: "", signedByUid: "" };

  return {
    sourceId: "regular-1",
    sourceCollection: "regularOnCallPeriods",
    title: "Astreinte export",
    exportTitle: "Astreintes régulières",
    initiatorName: "Initiateur",
    operationManagerName: "Responsable",
    forecastStartDate: "2026-07-03T18:00:00",
    forecastEndDate: "2026-07-06T08:00:00",
    actualStartDate: "2026-07-03T18:00:00",
    actualEndDate: "2026-07-06T08:00:00",
    plannedUsers: [{ name: "Agent Test", startDate: "2026-07-03T18:00:00", endDate: "2026-07-06T08:00:00", visa: unsignedVisa }],
    actualUsers: [{ name: "Agent Test", startDate: "2026-07-03T18:00:00", endDate: "2026-07-06T08:00:00", visa: unsignedVisa }],
    interventions: [
      {
        userName: "Agent Test",
        startDate: "2026-07-04T07:00:00",
        endDate: "2026-07-04T10:00:00",
        wasOnSite: true,
        comment: "Contrôle",
        visa: unsignedVisa,
      },
    ],
    initiatorVisa: unsignedVisa,
    directorVisa: unsignedVisa,
  };
}

function contextFixture(): RhExportContext {
  return {
    publicHolidays: [],
    onCallCompensationRules: [
      { id: "week", label: "Semaine", coefficient: 1 },
      { id: "weekendHoliday", label: "Samedi / Dimanche / Jour férié", coefficient: 2 },
    ],
    periodCompensationRules: [
      { id: "week_18_21", label: "Semaine 18h-21h", interventionCoefficient: 1, workCoefficient: 2, restCoefficient: 0 },
      { id: "night_21_7", label: "Nuit (21h-7h)", interventionCoefficient: 1.5, workCoefficient: 2.5, restCoefficient: 0 },
      { id: "week_7_8", label: "Semaine 7h-8h", interventionCoefficient: 1, workCoefficient: 2, restCoefficient: 0 },
      { id: "saturday_7_21", label: "Samedi (7h-21h)", interventionCoefficient: 2, workCoefficient: 3, restCoefficient: 1 },
      { id: "sunday_holiday_7_21", label: "Dimanche/Jours fériés (7h-21h)", interventionCoefficient: 2, workCoefficient: 3, restCoefficient: 1 },
    ],
  };
}

describe("Individual Excel export", () => {
  it("preserves calculation details, short periods and work-only rows", () => {
    const html = new RhExcelExportLibrary().buildExcelHtml("regular", operationFixture(), contextFixture());

    expect(html).toContain("Détail calcul");
    expect(html).toContain("sam 04/07/2026");
    expect(html).toContain("Jour de semaine : soirée de 18h à 24h");
    expect(html).toContain("Samedi / dimanche / jour férié : période complète retenue");
    expect(html).toContain("<br />");
    expect(html).toContain("<td>48</td>");
    expect(html).toContain("Samedi (7h-21h)");

    for (const templateId of ["regular", "exceptionalOnCall"] as const) {
      const shortPeriod = new RhExcelExportLibrary().buildExcelHtml(templateId, {
        ...operationFixture(),
        actualUsers: [{
          name: "Agent sans intervention",
          startDate: "2026-10-01T22:41:00",
          endDate: "2026-10-01T23:00:00",
          visa: operationFixture().directorVisa,
        }],
        interventions: [],
      }, contextFixture());
      expect(shortPeriod).toContain("<td>Agent sans intervention</td>");
      expect(shortPeriod).toContain("jeu 01/10/2026 22:41 - jeu 01/10/2026 23:00");
      expect(shortPeriod).toContain("= 0.32 h");
      expect(shortPeriod).toContain("<td>0</td>");
    }
    const workHtml = new RhExcelExportLibrary().buildExcelHtml("exceptionalWork", { ...operationFixture(), interventions: [] }, contextFixture());
    expect(workHtml).toContain("Samedi (7h-21h)");
    expect(workHtml).not.toContain("Samedi / dimanche / jour férié : période complète retenue");
  });
});
