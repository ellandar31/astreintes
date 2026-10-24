import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from "@angular/core";
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
import { selectCanExportRh } from "../../state/settings/settings.selectors";
import { RhPurgeActions, selectRhPurge } from "../../state/rh-purge/rh-purge.state";
import { RhPurgeOperation, RhRetentionYears } from "../../types/rh-purge.models";

/** Only the confirmation dialog is local; preview and asynchronous results live in NgRx. */
@Component({
  selector: "app-rh-purge", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ButtonModule, CardModule, MessageModule, SelectModule,
    ModalComponent, SharedTableModule, TableColumnHeaderComponent, TableRowsPipe],
  templateUrl: "./rh-purge.component.html",
  styles: [`
    .purge-controls { display: flex; flex-wrap: wrap; align-items: end; gap: var(--app-space-lg); }
    label { display: grid; gap: var(--app-space-xs); }
    .purge-content { display: grid; gap: var(--app-space-lg); }
  `],
})
export class RhPurgeComponent implements OnDestroy {
  readonly labels = APP_LABELS;
  readonly copy = APP_LABELS.rh.purge;
  private readonly store = inject(Store);
  readonly state = this.store.selectSignal(selectRhPurge);
  readonly canPurge = this.store.selectSignal(selectCanExportRh);
  readonly confirming = signal(false);
  readonly retentions = [
    { label: this.copy.oneYear, value: 1 }, { label: this.copy.twoYears, value: 2 },
  ];
  readonly fields = {
    typeLabel: (row: RhPurgeOperation) => APP_LABELS.rhDocuments.periodExport.sheets[row.type],
    treatedDate: (row: RhPurgeOperation) => tableDate(row.treatedAt),
  };

  constructor() { this.refresh(2); }

  refresh(years: RhRetentionYears = this.state().years): void {
    if (!this.canPurge() || this.state().purging || (years !== 1 && years !== 2)) return;
    this.confirming.set(false);
    this.store.dispatch(RhPurgeActions.previewRequested({ years }));
  }

  openConfirmation(): void {
    if (this.canPurge() && !this.state().loading && !this.state().purging && this.state().operations.length) this.confirming.set(true);
  }

  /** Confirm only the previewed snapshot; SQL locks and revalidates each treatment timestamp. */
  confirmPurge(): void {
    const state = this.state();
    if (!this.confirming() || !this.canPurge() || state.loading || state.purging || !state.operations.length) return;
    this.confirming.set(false);
    this.store.dispatch(RhPurgeActions.purgeRequested({ years: state.years, operations: state.operations.map(row => ({ ...row })) }));
  }

  ngOnDestroy(): void { this.store.dispatch(RhPurgeActions.closed()); }
}
