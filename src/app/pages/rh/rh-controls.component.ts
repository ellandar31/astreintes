import { CommonModule } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Unsubscribe, collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import {
  RhControlRow,
  RhExceptionalOperation,
  RhPublicHoliday,
  RhRegularPeriod,
  RhUser,
} from "./rh.models";

@Component({
  selector: "app-rh-controls",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./rh-controls.component.html",
  styleUrl: "./rh-controls.component.css",
})
export class RhControlsComponent implements OnDestroy {
  users: RhUser[] = [];
  regularPeriods: RhRegularPeriod[] = [];
  publicHolidays: RhPublicHoliday[] = [];
  exceptionalOperations: RhExceptionalOperation[] = [];

  selectedMonth = this.toMonthKey(new Date());
  selectedWeek = this.toWeekKey(new Date());
  selectedQuarter = this.toQuarterKey(new Date());

  private readonly unsubscribes: Unsubscribe[] = [
    onSnapshot(collection(db, "users"), (snapshot) => {
      this.users = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }) as RhUser)
        .filter((user) => Boolean(user.email))
        .sort((first, second) => this.userLabel(first).localeCompare(this.userLabel(second)));
    }),
    onSnapshot(collection(db, "regularOnCallPeriods"), (snapshot) => {
      this.regularPeriods = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as RhRegularPeriod);
    }),
    onSnapshot(collection(db, "publicHolidays"), (snapshot) => {
      this.publicHolidays = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as RhPublicHoliday);
    }),
    onSnapshot(collection(db, "exceptionalOperations"), (snapshot) => {
      this.exceptionalOperations = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }) as RhExceptionalOperation);
    }),
  ];

  ngOnDestroy(): void {
    this.unsubscribes.forEach((unsubscribe) => unsubscribe());
  }

  get monthOptions(): string[] {
    return this.uniqueSorted([
      this.selectedMonth,
      ...this.regularPeriods.flatMap((period) => [this.toMonthKey(new Date(period.startDate)), this.toMonthKey(new Date(period.endDate))]),
    ]).reverse();
  }

  get weekOptions(): string[] {
    const weeks = this.exceptionalOperations
      .filter((operation) => operation.type === "travaux")
      .flatMap((operation) => operation.interventions || [])
      .map((intervention) => this.toWeekKey(new Date(intervention.startDate)));

    return this.uniqueSorted([this.selectedWeek, ...weeks]).reverse();
  }

  get quarterOptions(): string[] {
    const quarters = this.exceptionalOperations
      .filter((operation) => operation.type === "travaux")
      .flatMap((operation) => operation.interventions || [])
      .map((intervention) => this.toQuarterKey(new Date(intervention.startDate)));

    return this.uniqueSorted([this.selectedQuarter, ...quarters]).reverse();
  }

  get rows(): RhControlRow[] {
    const monthRange = this.monthRange(this.selectedMonth);
    const weekRange = this.weekRange(this.selectedWeek);
    const quarterRange = this.quarterRange(this.selectedQuarter);
    const last15DaysEnd = new Date();
    const last15DaysStart = new Date(last15DaysEnd);
    last15DaysStart.setDate(last15DaysEnd.getDate() - 15);

    return this.users.map((user) => {
      const userPeriods = this.regularPeriods.filter((period) => period.userId === user.id);

      return {
        userId: user.id,
        userLabel: this.userLabel(user),
        onCallHoursLast15Days: this.roundHours(this.sumPeriodHours(userPeriods, last15DaysStart, last15DaysEnd)),
        onCallHoursMonth: this.roundHours(this.sumPeriodHours(userPeriods, monthRange.start, monthRange.end)),
        saturdayCount: this.countCoveredDays(userPeriods, monthRange.start, monthRange.end, (date) => date.getDay() === 6),
        sundayCount: this.countCoveredDays(userPeriods, monthRange.start, monthRange.end, (date) => date.getDay() === 0),
        holidayCount: this.countCoveredDays(userPeriods, monthRange.start, monthRange.end, (date) => this.isPublicHoliday(date)),
        exceptionalWorkHoursWeek: this.roundHours(this.sumExceptionalWorkHours(user.id, weekRange.start, weekRange.end)),
        exceptionalWorkHoursQuarter: this.roundHours(this.sumExceptionalWorkHours(user.id, quarterRange.start, quarterRange.end)),
      };
    });
  }

  formatMonth(monthKey: string): string {
    const [year, month] = monthKey.split("-").map(Number);
    return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  }

  formatQuarter(quarterKey: string): string {
    const [year, quarter] = quarterKey.split("-Q");
    return `${year} - T${quarter}`;
  }

  private userLabel(user: RhUser): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
  }

  private sumPeriodHours(periods: RhRegularPeriod[], rangeStart: Date, rangeEnd: Date): number {
    return periods.reduce((total, period) => {
      return total + this.overlapHours(new Date(period.startDate), new Date(period.endDate), rangeStart, rangeEnd);
    }, 0);
  }

  private sumExceptionalWorkHours(userId: string, rangeStart: Date, rangeEnd: Date): number {
    return this.exceptionalOperations
      .filter((operation) => operation.type === "travaux")
      .flatMap((operation) => operation.interventions || [])
      .filter((intervention) => intervention.userId === userId)
      .reduce((total, intervention) => {
        return total + this.overlapHours(new Date(intervention.startDate), new Date(intervention.endDate), rangeStart, rangeEnd);
      }, 0);
  }

  private countCoveredDays(
    periods: RhRegularPeriod[],
    rangeStart: Date,
    rangeEnd: Date,
    predicate: (date: Date) => boolean,
  ): number {
    const coveredDays = new Set<string>();
    const cursor = new Date(rangeStart);

    while (cursor < rangeEnd) {
      const dayStart = new Date(cursor);
      const dayEnd = new Date(cursor);
      dayEnd.setDate(dayEnd.getDate() + 1);

      if (
        predicate(dayStart) &&
        periods.some((period) => this.overlapHours(new Date(period.startDate), new Date(period.endDate), dayStart, dayEnd) > 0)
      ) {
        coveredDays.add(this.toDateKey(dayStart));
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return coveredDays.size;
  }

  private overlapHours(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): number {
    const overlapStart = Math.max(start.getTime(), rangeStart.getTime());
    const overlapEnd = Math.min(end.getTime(), rangeEnd.getTime());

    if (overlapEnd <= overlapStart) {
      return 0;
    }

    return (overlapEnd - overlapStart) / 36e5;
  }

  private monthRange(monthKey: string): { start: Date; end: Date } {
    const [year, month] = monthKey.split("-").map(Number);
    return {
      start: new Date(year, month - 1, 1),
      end: new Date(year, month, 1),
    };
  }

  private weekRange(weekKey: string): { start: Date; end: Date } {
    const [yearPart, weekPart] = weekKey.split("-W");
    const year = Number(yearPart);
    const week = Number(weekPart);
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const day = simple.getDay() || 7;
    const start = new Date(simple);
    start.setDate(simple.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }

  private quarterRange(quarterKey: string): { start: Date; end: Date } {
    const [yearPart, quarterPart] = quarterKey.split("-Q");
    const year = Number(yearPart);
    const quarter = Number(quarterPart);
    const startMonth = (quarter - 1) * 3;
    return {
      start: new Date(year, startMonth, 1),
      end: new Date(year, startMonth + 3, 1),
    };
  }

  private isPublicHoliday(date: Date): boolean {
    return this.publicHolidays.some((holiday) => holiday.date === this.toDateKey(date));
  }

  private toDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  private toMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  private toWeekKey(date: Date): string {
    const workingDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = workingDate.getUTCDay() || 7;
    workingDate.setUTCDate(workingDate.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(workingDate.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((workingDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${workingDate.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }

  private toQuarterKey(date: Date): string {
    return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
  }

  private uniqueSorted(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean))).sort((first, second) => first.localeCompare(second));
  }

  private roundHours(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
