import { ExportOperation, RhExportContext } from "./rh-export.models";
import { RhExcelExportLibrary } from "./rh-excel-export.lib";

function expect(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

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

const html = new RhExcelExportLibrary().buildExcelHtml("regular", operationFixture(), contextFixture());

expect(html.includes("Détail calcul"), "Le tableau Excel doit contenir la colonne de détail du calcul.");
expect(html.includes("sam 04/07/2026"), "Les dates Excel doivent comporter le trigramme du jour.");
expect(html.includes("Jour de semaine : soirée de 18h à 24h"), "Le détail doit expliquer le segment de semaine en soirée.");
expect(html.includes("Samedi / dimanche / jour férié : période complète retenue"), "Le détail doit expliquer les jours complets week-end/fériés.");
expect(html.includes("<br />"), "Les segments doivent être séparés par des retours à la ligne HTML.");
expect(html.includes("<td>48</td>"), "Le samedi et le dimanche complets doivent totaliser 48 h.");
expect(html.includes("Samedi (7h-21h)"), "Les règles d'intervention doivent être appliquées dans l'export Excel.");

console.log("rh-excel-export.lib: OK");
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
  expect(shortPeriod.includes("<td>Agent sans intervention</td>"), "Une courte astreinte sans intervention doit rester visible.");
  expect(shortPeriod.includes("jeu 01/10/2026 22:41 - jeu 01/10/2026 23:00"), "La ligne doit conserver la période réelle du participant.");
  expect(shortPeriod.includes("= 0.32 h"), "Le détail doit conserver la durée retenue avant arrondi.");
  expect(shortPeriod.includes("<td>0</td>"), "Le total payable doit conserver la règle d'arrondi existante.");
}
const workHtml = new RhExcelExportLibrary().buildExcelHtml("exceptionalWork", { ...operationFixture(), interventions: [] }, contextFixture());
expect(workHtml.includes("Samedi (7h-21h)"), "L'Excel travaux doit calculer les périodes des participants réels sans interventions.");
expect(!workHtml.includes("Samedi / dimanche / jour férié : période complète retenue"), "L'Excel travaux ne doit pas calculer d'indemnité d'astreinte.");
