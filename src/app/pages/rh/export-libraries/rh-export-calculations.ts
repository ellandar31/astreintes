import {
  CalculationSegment,
  ExportOperation,
  InterventionCompensationRow,
  OnCallCompensationRow,
  RhExportContext,
} from "./rh-export.models";
import { escapeHtml, formatRange, toDateKey } from "./rh-export-utils";

export class RhExportCalculationLibrary {
  constructor(private readonly context: RhExportContext) {}

  onCallCompensationRows(operation: ExportOperation): OnCallCompensationRow[] {
    return operation.actualUsers.flatMap((user) => {
      const { weekSegments, weekendHolidaySegments } = this.onCallSegmentsByCalendarRules(user.startDate, user.endDate);
      const weekRule = this.context.onCallCompensationRules.find((rule) => rule.id === "week");
      const weekendRule = this.context.onCallCompensationRules.find((rule) => rule.id === "weekendHoliday");

      return [
        {
          name: user.name,
          startDate: user.startDate,
          endDate: user.endDate,
          label: weekRule?.label || "Semaine",
          hours: this.roundToHour(this.totalHours(weekSegments)),
          coefficient: weekRule?.coefficient || 0,
          segments: weekSegments,
        },
        {
          name: user.name,
          startDate: user.startDate,
          endDate: user.endDate,
          label: weekendRule?.label || "Samedi / Dimanche / Jour férié",
          hours: this.roundToHour(this.totalHours(weekendHolidaySegments)),
          coefficient: weekendRule?.coefficient || 0,
          segments: weekendHolidaySegments,
        },
      ].filter((row) => row.hours > 0);
    });
  }

  interventionCompensationRows(operation: ExportOperation, isWork: boolean): InterventionCompensationRow[] {
    return operation.interventions.flatMap((intervention) =>
      this.applyInterventionRounding(
        this.context.periodCompensationRules
        .map((rule) => {
          const segments = this.segmentsForPeriodRule(intervention.startDate, intervention.endDate, rule.id);

          return {
            userName: intervention.userName,
            startDate: intervention.startDate,
            endDate: intervention.endDate,
            label: rule.label,
            hours: this.totalHours(segments),
            coefficient: isWork ? rule.workCoefficient : rule.interventionCoefficient,
            restCoefficient: rule.restCoefficient,
            comment: intervention.comment,
            segments,
          };
        })
          .filter((row) => row.hours > 0),
        intervention.startDate,
        intervention.endDate,
      ),
    );
  }

  segmentDetails(segments: CalculationSegment[]): string {
    if (!segments.length) {
      return "Aucun segment retenu";
    }

    return segments
      .map((segment) => {
        const detail = segment.detail ? `${segment.detail} - ` : "";
        return `${detail}${formatRange(segment.startDate, segment.endDate)} = ${segment.hours} h`;
      })
      .join("\n");
  }

  segmentDetailsHtml(segments: CalculationSegment[]): string {
    return escapeHtml(this.segmentDetails(segments)).replaceAll("\n", "<br />");
  }

  private onCallSegmentsByCalendarRules(startValue: string, endValue: string): { weekSegments: CalculationSegment[]; weekendHolidaySegments: CalculationSegment[] } {
    if (!startValue || !endValue) {
      return { weekSegments: [], weekendHolidaySegments: [] };
    }

    const start = new Date(startValue);
    const end = new Date(endValue);
    const weekSegments: CalculationSegment[] = [];
    const weekendHolidaySegments: CalculationSegment[] = [];
    let dayCursor = this.startOfDay(start);

    while (dayCursor < end) {
      const nextDay = this.addDays(dayCursor, 1);

      if (this.isWeekendOrHoliday(dayCursor)) {
        this.pushClippedSegment(weekendHolidaySegments, start, end, dayCursor, nextDay, "Samedi / dimanche / jour férié : période complète retenue");
      } else {
        this.pushClippedSegment(weekSegments, start, end, dayCursor, this.atTime(dayCursor, 8, 0), "Jour de semaine : nuit de 00h à 08h");
        this.pushClippedSegment(weekSegments, start, end, this.atTime(dayCursor, 18, 0), nextDay, "Jour de semaine : soirée de 18h à 24h");
      }

      dayCursor = nextDay;
    }

    return { weekSegments, weekendHolidaySegments };
  }

  private pushClippedSegment(segments: CalculationSegment[], periodStart: Date, periodEnd: Date, segmentStart: Date, segmentEnd: Date, detail: string): void {
    const start = new Date(Math.max(periodStart.getTime(), segmentStart.getTime()));
    const end = new Date(Math.min(periodEnd.getTime(), segmentEnd.getTime()));

    if (start >= end) {
      return;
    }

    segments.push({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      hours: this.roundHours((end.getTime() - start.getTime()) / 36e5),
      detail,
    });
  }

  private segmentsForPeriodRule(startValue: string, endValue: string, ruleId: string): CalculationSegment[] {
    return this.splitHourSegmentsByPredicate(startValue, endValue, (date) => {
      const hour = date.getHours() + date.getMinutes() / 60;
      const day = date.getDay();
      const isHoliday = this.isPublicHoliday(date);

      if (ruleId === "week_18_21") return day >= 1 && day <= 5 && !isHoliday && hour >= 18 && hour < 21;
      if (ruleId === "night_21_7") return hour >= 21 || hour < 7;
      if (ruleId === "week_7_8") return day >= 1 && day <= 5 && !isHoliday && hour >= 7 && hour < 8;
      if (ruleId === "saturday_7_21") return day === 6 && !isHoliday && hour >= 7 && hour < 21;
      if (ruleId === "sunday_7_21") return day === 0 && !isHoliday && hour >= 7 && hour < 21;
      if (ruleId === "holiday_7_21") return isHoliday && hour >= 7 && hour < 21;
      if (ruleId === "sunday_holiday_7_21") return (day === 0 || isHoliday) && hour >= 7 && hour < 21;
      return false;
    });
  }

  private splitHourSegmentsByPredicate(startValue: string, endValue: string, predicate: (date: Date) => boolean): CalculationSegment[] {
    if (!startValue || !endValue) return [];
    const end = new Date(endValue);
    const segments: CalculationSegment[] = [];
    let cursor = new Date(startValue);

    while (cursor < end) {
      const next = new Date(cursor);
      next.setMinutes(cursor.getMinutes() + 15, 0, 0);
      const segmentEnd = next < end ? next : end;

      if (predicate(cursor)) {
        const lastSegment = segments.at(-1);
        const segmentHours = (segmentEnd.getTime() - cursor.getTime()) / 36e5;

        if (lastSegment && new Date(lastSegment.endDate).getTime() === cursor.getTime()) {
          lastSegment.endDate = segmentEnd.toISOString();
          lastSegment.hours = this.roundHours(lastSegment.hours + segmentHours);
        } else {
          segments.push({
            startDate: cursor.toISOString(),
            endDate: segmentEnd.toISOString(),
            hours: this.roundHours(segmentHours),
          });
        }
      }

      cursor = segmentEnd;
    }

    return segments;
  }

  private totalHours(segments: CalculationSegment[]): number {
    return this.roundHours(segments.reduce((total, segment) => total + segment.hours, 0));
  }

  private applyInterventionRounding(rows: InterventionCompensationRow[], startValue: string, endValue: string): InterventionCompensationRow[] {
    if (!rows.length) {
      return rows;
    }

    const start = new Date(startValue);
    const end = new Date(endValue);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return rows;
    }

    const roundedDuration = Math.ceil((end.getTime() - start.getTime()) / 36e5);
    const countedHours = this.roundHours(rows.reduce((total, row) => total + row.hours, 0));
    const roundingDelta = this.roundHours(roundedDuration - countedHours);

    if (roundingDelta <= 0) {
      return rows;
    }

    const lastRowIndex = rows.reduce((latestIndex, row, index) => {
      const latestEnd = this.latestSegmentEndTime(row.segments);
      const currentLatestEnd = latestIndex >= 0 ? this.latestSegmentEndTime(rows[latestIndex].segments) : Number.NEGATIVE_INFINITY;
      return latestEnd > currentLatestEnd ? index : latestIndex;
    }, -1);

    if (lastRowIndex < 0) {
      return rows;
    }

    return rows.map((row, index) => (index === lastRowIndex ? { ...row, hours: this.roundHours(row.hours + roundingDelta) } : row));
  }

  private latestSegmentEndTime(segments: CalculationSegment[]): number {
    return segments.reduce((latest, segment) => Math.max(latest, new Date(segment.endDate).getTime()), Number.NEGATIVE_INFINITY);
  }

  private roundHours(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private roundToHour(value: number): number {
    return Math.round(value);
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  private atTime(date: Date, hours: number, minutes: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);
  }

  private isWeekendOrHoliday(date: Date): boolean {
    return date.getDay() === 0 || date.getDay() === 6 || this.isPublicHoliday(date);
  }

  private isPublicHoliday(date: Date): boolean {
    return this.context.publicHolidays.some((holiday) => holiday.date === toDateKey(date));
  }
}
