import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Store } from "@ngrx/store";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { MessageModule } from "primeng/message";
import { SelectModule } from "primeng/select";
import { APP_LABELS } from "../../i18n/labels";
import { ModalComponent } from "../../shared/modal.component";
import { SharedTableModule } from "../../shared/shared-table.module";
import { TableColumnHeaderComponent } from "../../shared/table-column-header.component";
import { TableRowsPipe, tableDate } from "../../shared/table-rows.pipe";
import { RhPurgeDetailComponent, purgePeriodLabel } from "./rh-purge-detail.component";
import { formatRhExportUser } from "./export-libraries/rh-export-user-label";
import { selectCanExportRh, selectSettingsUsers } from "../../state/settings/settings.selectors";
import { RhPurgeActions, selectRhPurge } from "../../state/rh-purge/rh-purge.state";
import { RhPurgeOperation, RhRetentionYears } from "../../types/rh-purge.models";

/** Only the confirmation dialog is local; preview and asynchronous results live in NgRx. */
@Component({
  selector: "app-rh-purge", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ButtonModule, CardModule, MessageModule, SelectModule,
    ModalComponent, RhPurgeDetailComponent, SharedTableModule, TableColumnHeaderComponent, TableRowsPipe],
  templateUrl: "./rh-purge.component.html",
  styles: [`
    .purge-controls { display: flex; flex-wrap: wrap; align-items: end; gap: var(--app-space-lg); }
    label { display: grid; gap: var(--app-space-xs); }
    .purge-content { display: grid; gap: var(--app-space-lg); }
  `],
})
export class RhPurgeComponent implements OnInit, OnDestroy {
  @Input() userMode = false;
  readonly labels = APP_LABELS;
  private readonly userCopy = { ...APP_LABELS.rh.purge, ...APP_LABELS.rh.userPurge };
  get copy() { return this.userMode ? this.userCopy : APP_LABELS.rh.purge; }
  readonly userCopyLabels = APP_LABELS.rh.userPurge;
  private readonly store = inject(Store);
  readonly state = this.store.selectSignal(selectRhPurge);
  readonly canPurge = this.store.selectSignal(selectCanExportRh);
  private readonly users = this.store.selectSignal(selectSettingsUsers);
  // Former employees are deliberately included: their historical rows can be purged.
  readonly userOptions = computed(() => this.users().map(user => ({
    id: user.id, label: formatRhExportUser(user.trigram, user.displayName, user.email),
  })).sort((a, b) => a.label.localeCompare(b.label, "fr")));
  readonly confirming = signal(false);
  readonly retentions = [
    { label: this.copy.oneYear, value: 1 }, { label: this.copy.twoYears, value: 2 },
  ];
  readonly fields = {
    typeLabel: (row: RhPurgeOperation) => APP_LABELS.rhDocuments.periodExport.sheets[row.type],
    outcome: (row: RhPurgeOperation) => row.deleteOperation ? this.userCopyLabels.deleteOperation : this.userCopyLabels.keepOperation,
    periodLabel: (row: RhPurgeOperation) => purgePeriodLabel(row.startsAt, row.endsAt),
    periodDate: (row: RhPurgeOperation) => tableDate(row.startsAt || row.endsAt),
    reference: (row: RhPurgeOperation) => Number(row.id),
    treatedDate: (row: RhPurgeOperation) => tableDate(row.treatedAt),
  };

  ngOnInit(): void {
    if (this.userMode) this.store.dispatch(RhPurgeActions.closed());
    else this.refresh(2);
  }

  selectUser(userId: string | null): void {
    if (!this.userMode || !this.canPurge() || this.state().purging) return;
    this.confirming.set(false);
    if (!userId) this.store.dispatch(RhPurgeActions.closed());
    else if (this.userOptions().some(user => user.id === userId)) this.store.dispatch(RhPurgeActions.userPreviewRequested({ userId }));
  }

  refresh(years: RhRetentionYears = this.state().years): void {
    if (this.userMode) { this.selectUser(this.state().userId); return; }
    if (!this.canPurge() || this.state().purging || (years !== 1 && years !== 2)) return;
    this.confirming.set(false);
    this.store.dispatch(RhPurgeActions.previewRequested({ years }));
  }

  consult(row: RhPurgeOperation): void {
    const state = this.state();
    const candidate = state.operations.find(item => item.type === row.type && item.id === row.id);
    if (!this.userMode || !this.canPurge() || this.confirming() || !state.userId || state.loading || state.purging || !candidate) return;
    this.store.dispatch(RhPurgeActions.detailRequested({ row: candidate, userId: state.userId }));
  }

  closeDetail(): void { this.store.dispatch(RhPurgeActions.detailClosed()); }

  openConfirmation(): void {
    if (this.canPurge() && !this.state().detail && !this.state().loading && !this.state().purging && this.state().operations.length) this.confirming.set(true);
  }

  /** Confirm only the previewed snapshot; SQL locks and revalidates each treatment timestamp. */
  confirmPurge(): void {
    const state = this.state();
    if (!this.confirming() || !this.canPurge() || state.loading || state.purging || !state.operations.length) return;
    this.confirming.set(false);
    const operations = state.operations.map(row => ({ ...row }));
    if (this.userMode) {
      if (state.userId) this.store.dispatch(RhPurgeActions.userPurgeRequested({ userId: state.userId, operations }));
    } else {
      this.store.dispatch(RhPurgeActions.purgeRequested({ years: state.years, operations }));
    }
  }

  ngOnDestroy(): void { this.store.dispatch(RhPurgeActions.closed()); }
}
