import { createEmptyVisa } from "../../../shared/visa.models";
import { ExportOperation, RhExportContext } from "./rh-export.models";
import { RhExportCalculationLibrary } from "./rh-export-calculations";

const context: RhExportContext = {
  publicHolidays: [{ date: "2026-07-14", label: "Fête nationale" }],
  onCallCompensationRules: [
    { id: "week", label: "Semaine", coefficient: 1 },
    { id: "weekendHoliday", label: "Samedi / Dimanche / Jour férié", coefficient: 2 },
  ],
  periodCompensationRules: [
    { id: "week_18_21", label: "Semaine 18h-21h", interventionCoefficient: 1, workCoefficient: 10, restCoefficient: 0 },
    { id: "night_21_7", label: "Nuit 21h-7h", interventionCoefficient: 2, workCoefficient: 20, restCoefficient: 0 },
    { id: "week_7_8", label: "Semaine 7h-8h", interventionCoefficient: 3, workCoefficient: 30, restCoefficient: 0 },
    { id: "saturday_7_21", label: "Samedi 7h-21h", interventionCoefficient: 4, workCoefficient: 40, restCoefficient: 0 },
    { id: "sunday_holiday_7_21", label: "Dimanche/Jour férié 7h-21h", interventionCoefficient: 5, workCoefficient: 50, restCoefficient: 0 },
  ],
};

function operation(partial: Partial<ExportOperation>): ExportOperation {
  return {
    sourceId: "operation-1",
    sourceCollection: "exceptionalOperations",
    title: "Operation",
    exportTitle: "Operation",
    initiatorName: "Initiateur",
    operationManagerName: "Responsable",
    forecastStartDate: "",
    forecastEndDate: "",
    actualStartDate: "",
    actualEndDate: "",
    plannedUsers: [],
    actualUsers: [],
    interventions: [],
    initiatorVisa: createEmptyVisa(),
    directorVisa: createEmptyVisa(),
    ...partial,
  };
}

describe("RhExportCalculationLibrary", () => {
  it("compte une astreinte de semaine uniquement sur les plages non ouvrées", () => {
    const rows = new RhExportCalculationLibrary(context).onCallCompensationRows(
      operation({
        actualUsers: [{ name: "Agent", startDate: "2026-07-06T17:00:00", endDate: "2026-07-07T10:00:00", visa: createEmptyVisa() }],
      }),
    );

    expect(rows).toEqual([
      expect.objectContaining({ coefficient: 1, hours: 14, label: "Semaine", name: "Agent" }),
    ]);
    expect(rows[0].segments.map((segment) => segment.detail)).toEqual([
      "Jour de semaine : soirée de 18h à 24h",
      "Jour de semaine : nuit de 00h à 08h",
    ]);
  });

  it("compte les samedis, dimanches et jours fériés sur toute la période couverte", () => {
    const rows = new RhExportCalculationLibrary(context).onCallCompensationRows(
      operation({
        actualUsers: [{ name: "Agent", startDate: "2026-07-13T18:00:00", endDate: "2026-07-15T08:00:00", visa: createEmptyVisa() }],
      }),
    );

    expect(rows).toEqual([
      expect.objectContaining({ hours: 14, label: "Semaine" }),
      expect.objectContaining({ hours: 24, label: "Samedi / Dimanche / Jour férié" }),
    ]);
  });

  it("arrondit les interventions à l'heure supérieure en portant l'écart sur la dernière tranche", () => {
    const rows = new RhExportCalculationLibrary(context).interventionCompensationRows(
      operation({
        interventions: [
          {
            userName: "Agent",
            startDate: "2026-07-06T20:30:00",
            endDate: "2026-07-06T21:30:00",
            wasOnSite: true,
            comment: "",
            visa: createEmptyVisa(),
          },
        ],
      }),
      false,
    );

    expect(rows).toEqual([
      expect.objectContaining({ coefficient: 1, hours: 0.5, label: "Semaine 18h-21h" }),
      expect.objectContaining({ coefficient: 2, hours: 0.5, label: "Nuit 21h-7h" }),
    ]);
  });

  it("expose le détail texte et HTML des segments pour les contrôles RH", () => {
    const library = new RhExportCalculationLibrary(context);
    const detail = library.segmentDetails([
      { startDate: "2026-07-06T18:00:00.000Z", endDate: "2026-07-06T20:00:00.000Z", hours: 2, detail: "Soirée" },
      { startDate: "2026-07-07T00:00:00.000Z", endDate: "2026-07-07T08:00:00.000Z", hours: 8, detail: "Nuit" },
    ]);

    expect(detail).toContain("\n");
    expect(
      library.segmentDetailsHtml([
        { startDate: "2026-07-06T18:00:00.000Z", endDate: "2026-07-06T20:00:00.000Z", hours: 2, detail: "<soirée>" },
      ]),
    ).toContain("&lt;soirée&gt;");
  });
});
