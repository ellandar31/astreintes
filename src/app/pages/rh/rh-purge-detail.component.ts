import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { Store } from "@ngrx/store";
import { TagModule } from "primeng/tag";
import { APP_LABELS } from "../../i18n/labels";
import { SharedTableModule } from "../../shared/shared-table.module";
import { TableRowsPipe } from "../../shared/table-rows.pipe";
import { selectSettingsDirections } from "../../state/settings/settings.selectors";
import { RhPurgeDetail, RhPurgeOperation } from "../../types/rh-purge.models";
import { SignatureVisa } from "../../types/signature.models";
import { formatOptionalDateTime } from "./export-libraries/rh-export-utils";

export function purgePeriodLabel(start?: string, end?: string): string {
  return [start, end].filter((value): value is string => !!value && Number.isFinite(Date.parse(value)))
    .map(formatOptionalDateTime).join(" – ") || APP_LABELS.common.empty.dash;
}

interface DetailLine {
  element: string;
  person?: string;
  period?: string;
  ticket?: string;
  notes?: string;
  visa?: SignatureVisa;
  removed: boolean;
}

/** Project the full aggregate; the purge target affects badges only, never visibility. */
@Component({
  selector: "app-rh-purge-detail",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SharedTableModule, TableRowsPipe, TagModule],
  templateUrl: "./rh-purge-detail.component.html",
  styles: [`
    dl { display: grid; grid-template-columns: max-content 1fr; gap: var(--app-space-xs) var(--app-space-md); }
    dd { margin: 0; overflow-wrap: anywhere; }
  `],
})
export class RhPurgeDetailComponent {
  readonly data = input.required<RhPurgeDetail>();
  readonly row = input.required<RhPurgeOperation>();
  readonly userId = input.required<string>();
  readonly labels = APP_LABELS;
  readonly copy = APP_LABELS.rh.userPurge;
  private readonly directions = inject(Store).selectSignal(selectSettingsDirections);
  readonly summary = computed(() => {
    const data = this.data();
    const source = data.type === "regular" ? data.period : data.operation;
    return {
      direction: this.directions().find(direction => direction.id === source.directionId)?.name,
      sentToRhAt: source.sentToRhAt,
      treatedAt: source.treatedAt,
      planned: data.type === "regular" ? purgePeriodLabel(data.period.startDate, data.period.endDate)
        : purgePeriodLabel(data.operation.startDate, data.operation.forecastEndDate),
      actual: data.type === "exceptional" ? purgePeriodLabel(data.operation.actualStartDate, data.operation.actualEndDate) : undefined,
      initiator: data.type === "exceptional" ? data.operation.initiatorName : undefined,
      manager: data.type === "exceptional" ? data.operation.operationManagerName : undefined,
    };
  });

  readonly lines = computed<DetailLine[]>(() => {
    const data = this.data();
    const wholeOperation = !!this.row().deleteOperation;
    const removed = (id: string) => wholeOperation || id === this.userId();
    const intervention = (item: {
      userId?: string; userName: string; userEmail: string; startDate: string; endDate: string;
      ticket?: string; comment?: string; label?: string; wasOnSite?: boolean; agentVisa?: SignatureVisa;
    }): DetailLine => ({
      element: this.copy.intervention, person: item.userName || item.userEmail,
      period: purgePeriodLabel(item.startDate, item.endDate), ticket: item.ticket,
      notes: [item.label, item.comment, item.wasOnSite ? this.copy.onSite : undefined].filter(Boolean).join(" — "),
      visa: item.agentVisa, removed: removed(item.userId || ""),
    });
    const visaLine = (element: string, visa?: SignatureVisa): DetailLine => ({
      element, person: visa?.signedByName, visa, removed: wholeOperation,
    });
    if (data.type === "regular") return [
      { element: this.copy.holder, person: data.period.userName || data.period.userEmail,
        period: purgePeriodLabel(data.period.startDate, data.period.endDate), visa: data.period.agentVisa, removed: wholeOperation },
      ...data.interventions.map(intervention),
      visaLine(this.copy.directorVisa, data.period.directorVisa),
    ];

    const operation = data.operation;
    const participation = (element: string, person: typeof operation.plannedUsers[number]): DetailLine => ({
      element, person: person.displayName || person.email, period: purgePeriodLabel(person.startDate, person.endDate),
      visa: person.visa, removed: removed(person.userId),
    });
    const visas = operation.visas;
    return [
      ...operation.plannedUsers.map(person => participation(this.copy.plannedParticipant, person)),
      ...operation.actualUsers.map(person => participation(this.copy.actualParticipant, person)),
      ...operation.interventions.map(intervention),
      ...[visaLine(this.copy.initiatorVisa, visas.initiatorGlobal), visaLine(this.copy.directorVisa, visas.directorGlobal),
        visaLine(this.copy.initiatorVisa + " — " + this.labels.exceptional.sections.planned, visas.plannedInitiator),
        visaLine(this.copy.directorVisa + " — " + this.labels.exceptional.sections.planned, visas.plannedDirector),
        visaLine(this.copy.initiatorVisa + " — " + this.labels.exceptional.sections.actual, visas.actualInitiator),
        visaLine(this.copy.directorVisa + " — " + this.labels.exceptional.sections.actual, visas.actualDirector),
      ].filter(line => line.visa?.signed),
    ];
  });
}
