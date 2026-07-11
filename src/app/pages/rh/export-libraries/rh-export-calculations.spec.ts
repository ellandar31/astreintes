import { RhExportCalculationLibrary } from "./rh-export-calculations";
import { CalculationSegment, ExportOperation, RhExportContext } from "./rh-export.models";
import { toDateKey } from "./rh-export-utils";

interface OnCallExpectedHours {
  week: number;
  saturday: number;
  sunday: number;
  holiday: number;
}

interface OnCallCase {
  name: string;
  startDate: string;
  endDate: string;
  expected: OnCallExpectedHours;
}

const unsignedVisa = { signed: false, signedAt: "", signedByName: "", signedByUid: "" };

const context: RhExportContext = {
  publicHolidays: [{ date: "2026-07-14", label: "Fête nationale" }],
  onCallCompensationRules: [
    { id: "week", label: "Semaine", coefficient: 1 },
    { id: "weekendHoliday", label: "Week-end ou férié", coefficient: 2 },
  ],
  periodCompensationRules: [],
};

const cases: OnCallCase[] = [
  {
    name: "2026-07-06 17:00 - 2026-07-06 23:00 / Début semaine avant 18h retenu à partir de 18h",
    startDate: "2026-07-06T17:00:00",
    endDate: "2026-07-06T23:00:00",
    expected: { week: 5, saturday: 0, sunday: 0, holiday: 0 },
  },
  {
    name: "2026-07-06 20:00 - 2026-07-06 23:00 / Début semaine après 18h retenu depuis l'heure réelle",
    startDate: "2026-07-06T20:00:00",
    endDate: "2026-07-06T23:00:00",
    expected: { week: 3, saturday: 0, sunday: 0, holiday: 0 },
  },
  {
    name: "2026-07-07 00:00 - 2026-07-07 06:00 / Fin semaine avant 08h retenue jusqu'à l'heure réelle",
    startDate: "2026-07-07T00:00:00",
    endDate: "2026-07-07T06:00:00",
    expected: { week: 6, saturday: 0, sunday: 0, holiday: 0 },
  },
  {
    name: "2026-07-07 00:00 - 2026-07-07 10:00 / Fin semaine après 08h plafonnée à 08h",
    startDate: "2026-07-07T00:00:00",
    endDate: "2026-07-07T10:00:00",
    expected: { week: 8, saturday: 0, sunday: 0, holiday: 0 },
  },
  {
    name: "2026-07-06 00:00 - 2026-07-08 00:00 / Jour de semaine complet englobé compte nuit et soirée",
    startDate: "2026-07-06T00:00:00",
    endDate: "2026-07-08T00:00:00",
    expected: { week: 28, saturday: 0, sunday: 0, holiday: 0 },
  },
  {
    name: "2026-07-04 10:00 - 2026-07-04 18:00 / Début samedi retenu depuis l'heure réelle",
    startDate: "2026-07-04T10:00:00",
    endDate: "2026-07-04T18:00:00",
    expected: { week: 0, saturday: 8, sunday: 0, holiday: 0 },
  },
  {
    name: "2026-07-04 22:00 - 2026-07-05 10:00 / Fin dimanche retenue jusqu'à l'heure réelle",
    startDate: "2026-07-04T22:00:00",
    endDate: "2026-07-05T10:00:00",
    expected: { week: 0, saturday: 2, sunday: 10, holiday: 0 },
  },
  {
    name: "2026-07-03 17:00 - 2026-07-06 10:00 / Semaine à semaine avec samedi et dimanche englobés",
    startDate: "2026-07-03T17:00:00",
    endDate: "2026-07-06T10:00:00",
    expected: { week: 14, saturday: 24, sunday: 24, holiday: 0 },
  },
  {
    name: "2026-07-14 10:00 - 2026-07-14 15:00 / Jour férié de semaine retenu comme période complète",
    startDate: "2026-07-14T10:00:00",
    endDate: "2026-07-14T15:00:00",
    expected: { week: 0, saturday: 0, sunday: 0, holiday: 5 },
  },
  {
    name: "2026-07-13 18:00 - 2026-07-15 08:00 / Jour férié complet dans une période de semaine",
    startDate: "2026-07-13T18:00:00",
    endDate: "2026-07-15T08:00:00",
    expected: { week: 14, saturday: 0, sunday: 0, holiday: 24 },
  },
  {
    name: "2026-07-06 18:15 - 2026-07-06 19:45 / Découpage au quart d'heure",
    startDate: "2026-07-06T18:15:00",
    endDate: "2026-07-06T19:45:00",
    expected: { week: 2, saturday: 0, sunday: 0, holiday: 0 },
  },
  {
    name: "Période vide sans heures retenues",
    startDate: "",
    endDate: "",
    expected: { week: 0, saturday: 0, sunday: 0, holiday: 0 },
  },
];

function operation(startDate: string, endDate: string): ExportOperation {
  return {
    sourceId: "period-1",
    sourceCollection: "regularOnCallPeriods",
    title: "Astreinte test",
    exportTitle: "Astreintes régulières",
    initiatorName: "",
    operationManagerName: "",
    forecastStartDate: startDate,
    forecastEndDate: endDate,
    actualStartDate: startDate,
    actualEndDate: endDate,
    plannedUsers: [{ name: "Agent Test", startDate, endDate, visa: unsignedVisa }],
    actualUsers: [{ name: "Agent Test", startDate, endDate, visa: unsignedVisa }],
    interventions: [],
    initiatorVisa: unsignedVisa,
    directorVisa: unsignedVisa,
  };
}

function actualHours(startDate: string, endDate: string): OnCallExpectedHours {
  const rows = new RhExportCalculationLibrary(context).onCallCompensationRows(operation(startDate, endDate));
  const weekRow = rows.find((row) => row.label === "Semaine");
  const weekendHolidayRow = rows.find((row) => row.label === "Week-end ou férié");

  return {
    week: weekRow?.hours || 0,
    ...weekendHolidayBreakdown(weekendHolidayRow?.segments || []),
  };
}

function weekendHolidayBreakdown(segments: CalculationSegment[]): Pick<OnCallExpectedHours, "saturday" | "sunday" | "holiday"> {
  const totals = segments.reduce(
    (accumulator, segment) => {
      const segmentDate = new Date(segment.startDate);
      const dateKey = toDateKey(segmentDate);

      if (context.publicHolidays.some((holiday) => holiday.date === dateKey)) {
        accumulator.holiday += segment.hours;
      } else if (segmentDate.getDay() === 6) {
        accumulator.saturday += segment.hours;
      } else if (segmentDate.getDay() === 0) {
        accumulator.sunday += segment.hours;
      }

      return accumulator;
    },
    { saturday: 0, sunday: 0, holiday: 0 },
  );

  return {
    saturday: Math.round(totals.saturday),
    sunday: Math.round(totals.sunday),
    holiday: Math.round(totals.holiday),
  };
}

function sameHours(actual: OnCallExpectedHours, expected: OnCallExpectedHours): boolean {
  return actual.week === expected.week && actual.saturday === expected.saturday && actual.sunday === expected.sunday && actual.holiday === expected.holiday;
}

function formatActualHours(hours: OnCallExpectedHours): string {
  return [
    "obtenu:",
    `                               semaine=${hours.week},`,
    `                               samedi=${hours.saturday},`,
    `                               dimanche=${hours.sunday},`,
    `                               ferie=${hours.holiday}`,
  ].join("\n");
}

const failedCases = cases
  .map((testCase) => {
    const actual = actualHours(testCase.startDate, testCase.endDate);
    const ok = sameHours(actual, testCase.expected);
    console.log(`${ok ? "OK" : "KO"} - ${testCase.name} |\n                      ${formatActualHours(actual)}`);
    return ok ? null : testCase.name;
  })
  .filter((name): name is string => Boolean(name));

if (failedCases.length) {
  throw new Error(`Cas onCallCompensationRows en échec: ${failedCases.join(", ")}`);
}

console.log("rh-export-calculations.onCallCompensationRows: OK");
