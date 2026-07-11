import { RhExportCalculationLibrary } from "./rh-export-calculations";
import { ExportOperation, RhExportContext } from "./rh-export.models";

interface InterventionExpectedHours {
  semaine18h21h: number;
  nuit21h7h: number;
  semaine7h8h: number;
  samedi7h21h: number;
  dimanche7h21h: number;
  jourFerie7h21h: number;
}

interface InterventionCase {
  name: string;
  startDate: string;
  endDate: string;
  expected: InterventionExpectedHours;
}

const emptyHours: InterventionExpectedHours = {
  semaine18h21h: 0,
  nuit21h7h: 0,
  semaine7h8h: 0,
  samedi7h21h: 0,
  dimanche7h21h: 0,
  jourFerie7h21h: 0,
};

const unsignedVisa = { signed: false, signedAt: "", signedByName: "", signedByUid: "" };

const context: RhExportContext = {
  publicHolidays: [{ date: "2026-07-14", label: "Fête nationale" }],
  onCallCompensationRules: [],
  periodCompensationRules: [
    { id: "week_18_21", label: "semaine18h21h", interventionCoefficient: 1, workCoefficient: 1, restCoefficient: 0 },
    { id: "night_21_7", label: "nuit21h7h", interventionCoefficient: 1, workCoefficient: 1, restCoefficient: 0 },
    { id: "week_7_8", label: "semaine7h8h", interventionCoefficient: 1, workCoefficient: 1, restCoefficient: 0 },
    { id: "saturday_7_21", label: "samedi7h21h", interventionCoefficient: 1, workCoefficient: 1, restCoefficient: 0 },
    { id: "sunday_7_21", label: "dimanche7h21h", interventionCoefficient: 1, workCoefficient: 1, restCoefficient: 0 },
    { id: "holiday_7_21", label: "jourFerie7h21h", interventionCoefficient: 1, workCoefficient: 1, restCoefficient: 0 },
  ],
};

const cases: InterventionCase[] = [
  {
    name: "06/07/2026 18:00 -> 06/07/2026 21:00 / Semaine 18h-21h",
    startDate: "2026-07-06T18:00:00",
    endDate: "2026-07-06T21:00:00",
    expected: { ...emptyHours, semaine18h21h: 3 },
  },
  {
    name: "06/07/2026 21:00 -> 07/07/2026 07:00 / Nuit complète",
    startDate: "2026-07-06T21:00:00",
    endDate: "2026-07-07T07:00:00",
    expected: { ...emptyHours, nuit21h7h: 10 },
  },
  {
    name: "07/07/2026 07:00 -> 07/07/2026 08:00 / Semaine 7h-8h",
    startDate: "2026-07-07T07:00:00",
    endDate: "2026-07-07T08:00:00",
    expected: { ...emptyHours, semaine7h8h: 1 },
  },
  {
    name: "06/07/2026 18:00 -> 07/07/2026 08:00 / Intervention complète de semaine",
    startDate: "2026-07-06T18:00:00",
    endDate: "2026-07-07T08:00:00",
    expected: { ...emptyHours, semaine18h21h: 3, nuit21h7h: 10, semaine7h8h: 1 },
  },
  {
    name: "04/07/2026 07:00 -> 04/07/2026 21:00 / Samedi 7h-21h",
    startDate: "2026-07-04T07:00:00",
    endDate: "2026-07-04T21:00:00",
    expected: { ...emptyHours, samedi7h21h: 14 },
  },
  {
    name: "05/07/2026 07:00 -> 05/07/2026 21:00 / Dimanche 7h-21h",
    startDate: "2026-07-05T07:00:00",
    endDate: "2026-07-05T21:00:00",
    expected: { ...emptyHours, dimanche7h21h: 14 },
  },
  {
    name: "14/07/2026 07:00 -> 14/07/2026 21:00 / Jour férié 7h-21h",
    startDate: "2026-07-14T07:00:00",
    endDate: "2026-07-14T21:00:00",
    expected: { ...emptyHours, jourFerie7h21h: 14 },
  },
  {
    name: "04/07/2026 07:00 -> 05/07/2026 10:00 / Samedi vers dimanche",
    startDate: "2026-07-04T07:00:00",
    endDate: "2026-07-05T10:00:00",
    expected: { ...emptyHours, nuit21h7h: 10, samedi7h21h: 14, dimanche7h21h: 3 },
  },
  {
    name: "05/07/2026 20:00 -> 06/07/2026 08:00 / Dimanche vers lundi",
    startDate: "2026-07-05T20:00:00",
    endDate: "2026-07-06T08:00:00",
    expected: { ...emptyHours, nuit21h7h: 10, semaine7h8h: 1, dimanche7h21h: 1 },
  },
  {
    name: "13/07/2026 18:00 -> 14/07/2026 10:00 / Veille de jour férié vers jour férié",
    startDate: "2026-07-13T18:00:00",
    endDate: "2026-07-14T10:00:00",
    expected: { ...emptyHours, semaine18h21h: 3, nuit21h7h: 10, jourFerie7h21h: 3 },
  },
  {
    name: "06/07/2026 20:30 -> 06/07/2026 22:15 / Passage de la tranche semaine à la nuit",
    startDate: "2026-07-06T20:30:00",
    endDate: "2026-07-06T22:15:00",
    expected: { ...emptyHours, semaine18h21h: 0.5, nuit21h7h: 1.5 },
  },
  {
    name: "07/07/2026 06:30 -> 07/07/2026 07:30 / Passage de la nuit à la tranche 7h-8h",
    startDate: "2026-07-07T06:30:00",
    endDate: "2026-07-07T07:30:00",
    expected: { ...emptyHours, nuit21h7h: 0.5, semaine7h8h: 0.5 },
  },
  {
    name: "06/07/2026 20:30 -> 06/07/2026 21:30 / Passage exact de la borne 21h",
    startDate: "2026-07-06T20:30:00",
    endDate: "2026-07-06T21:30:00",
    expected: { ...emptyHours, semaine18h21h: 0.5, nuit21h7h: 0.5 },
  },
  {
    name: "06/07/2026 10:00 -> 06/07/2026 12:00 / Heures ouvrées non comptabilisées",
    startDate: "2026-07-06T10:00:00",
    endDate: "2026-07-06T12:00:00",
    expected: { ...emptyHours },
  },
  {
    name: "06/07/2026 17:30 -> 06/07/2026 19:30 / Période partiellement comptabilisée",
    startDate: "2026-07-06T17:30:00",
    endDate: "2026-07-06T19:30:00",
    expected: { ...emptyHours, semaine18h21h: 2 },
  },
  {
    name: "06/07/2026 18:30 -> 06/07/2026 19:00 / Période partiellement comptabilisée",
    startDate: "2026-07-06T18:30:00",
    endDate: "2026-07-06T19:00:00",
    expected: { ...emptyHours, semaine18h21h: 1 },
  },
  {
    name: "06/07/2026 18:00 -> 06/07/2026 18:00 / Durée nulle",
    startDate: "2026-07-06T18:00:00",
    endDate: "2026-07-06T18:00:00",
    expected: { ...emptyHours },
  },
  {
    name: "06/07/2026 21:00 -> 06/07/2026 18:00 / Date de fin antérieure",
    startDate: "2026-07-06T21:00:00",
    endDate: "2026-07-06T18:00:00",
    expected: { ...emptyHours },
  },
  {
    name: "Date absente / Chaînes vides",
    startDate: "",
    endDate: "",
    expected: { ...emptyHours },
  },
  {
    name: "Date invalide",
    startDate: "date-invalide",
    endDate: "2026-07-06T18:00:00",
    expected: { ...emptyHours },
  },
];

function operation(startDate: string, endDate: string): ExportOperation {
  return {
    sourceId: "intervention-1",
    sourceCollection: "regularOnCallPeriods",
    title: "Intervention test",
    exportTitle: "Interventions",
    initiatorName: "",
    operationManagerName: "",
    forecastStartDate: startDate,
    forecastEndDate: endDate,
    actualStartDate: startDate,
    actualEndDate: endDate,
    plannedUsers: [],
    actualUsers: [],
    interventions: [
      {
        userName: "Agent Test",
        startDate,
        endDate,
        wasOnSite: true,
        comment: "",
        visa: unsignedVisa,
      },
    ],
    initiatorVisa: unsignedVisa,
    directorVisa: unsignedVisa,
  };
}

function actualHours(startDate: string, endDate: string): InterventionExpectedHours {
  const rows = new RhExportCalculationLibrary(context).interventionCompensationRows(operation(startDate, endDate), false);

  return rows.reduce<InterventionExpectedHours>(
    (accumulator, row) => {
      accumulator[row.label as keyof InterventionExpectedHours] = row.hours;
      return accumulator;
    },
    { ...emptyHours },
  );
}

function hasNoNan(hours: InterventionExpectedHours): boolean {
  return Object.values(hours).every((value) => !Number.isNaN(value));
}

function sameHours(actual: InterventionExpectedHours, expected: InterventionExpectedHours): boolean {
  return (
    actual.semaine18h21h === expected.semaine18h21h &&
    actual.nuit21h7h === expected.nuit21h7h &&
    actual.semaine7h8h === expected.semaine7h8h &&
    actual.samedi7h21h === expected.samedi7h21h &&
    actual.dimanche7h21h === expected.dimanche7h21h &&
    actual.jourFerie7h21h === expected.jourFerie7h21h
  );
}

function formatActualHours(hours: InterventionExpectedHours): string {
  return [
    "obtenu:",
    `                               semaine18h21h=${hours.semaine18h21h},`,
    `                               nuit21h7h=${hours.nuit21h7h},`,
    `                               semaine7h8h=${hours.semaine7h8h},`,
    `                               samedi7h21h=${hours.samedi7h21h},`,
    `                               dimanche7h21h=${hours.dimanche7h21h},`,
    `                               jourFerie7h21h=${hours.jourFerie7h21h}`,
  ].join("\n");
}

const failedCases = cases
  .map((testCase) => {
    const actual = actualHours(testCase.startDate, testCase.endDate);
    const ok = hasNoNan(actual) && sameHours(actual, testCase.expected);
    console.log(`${ok ? "OK" : "KO"} - ${testCase.name} |\n                      ${formatActualHours(actual)}`);
    return ok ? null : testCase.name;
  })
  .filter((name): name is string => Boolean(name));

if (failedCases.length) {
  throw new Error(`Cas interventionCompensationRows en échec: ${failedCases.join(", ")}`);
}

console.log("rh-export-calculations.interventionCompensationRows: OK");
