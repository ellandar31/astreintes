import { ChangeDetectionStrategy, Component, computed, input, model, output } from "@angular/core";
import { ButtonModule } from "primeng/button";
import { APP_LABELS } from "../../i18n/labels";
import { TruncatedTextComponent } from "../truncated-text.component";
import { CalendarEntry, CalendarHoliday } from "./calendar.models";
import { buildCalendarDays } from "./calendar.utils";

/** Reusable monthly view: business ownership, data loading and editing belong to the parent. */
@Component({
  selector: "app-calendar",
  standalone: true,
  imports: [ButtonModule, TruncatedTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./calendar.component.html",
  styleUrl: "./calendar.component.css",
})
export class CalendarComponent {
  readonly labels = APP_LABELS.calendar;
  readonly month = model(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly entries = input<readonly CalendarEntry[]>([]);
  readonly holidays = input<readonly CalendarHoliday[]>([]);
  /** Callers can replace or hide the disabled-entry explanation in other business contexts. */
  readonly disabledLegend = input<string>(APP_LABELS.calendar.disabledLegend);
  readonly entryActivated = output<CalendarEntry>();
  readonly monthLabel = computed(() => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(this.month()));
  readonly days = computed(() => buildCalendarDays(this.month(), this.entries(), this.holidays()));

  /** Emit a new Date instead of mutating the month supplied by a parent. */
  changeMonth(offset: number): void {
    const current = this.month();
    this.month.set(new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  activateEntry(entry: CalendarEntry): void {
    if (!entry.disabled) this.entryActivated.emit(entry);
  }
}
