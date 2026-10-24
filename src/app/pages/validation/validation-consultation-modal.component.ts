import { TableColumnHeaderComponent } from "../../shared/table-column-header.component";
import { TableRowsPipe, tableDate } from "../../shared/table-rows.pipe";
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ButtonModule } from "primeng/button";
import { TableModule } from "primeng/table";
import { TagModule } from "primeng/tag";
import { APP_LABELS } from "../../i18n/labels";
import { ModalComponent } from "../../shared/modal.component";
import { TruncatedTextComponent } from "../../shared/truncated-text.component";
import { ValidationItem, VisaProgressItem } from "./validation.models";

@Component({
  selector: "app-validation-consultation-modal",
  standalone: true,
  imports: [TableColumnHeaderComponent, TableRowsPipe, ButtonModule, CommonModule, ModalComponent, TableModule, TagModule, TruncatedTextComponent],
  templateUrl: "./validation-consultation-modal.component.html",
  styleUrl: "./validation-consultation-modal.component.css",
})
export class ValidationConsultationModalComponent {
  readonly progressTableFields = {
    tableStartDate: (row: VisaProgressItem) => tableDate(row.startDate),
    tablePeriod: (row: VisaProgressItem) => `${this.formatDateTime(row.startDate)} - ${this.formatDateTime(row.endDate)}`,
    tableSignedDate: (row: VisaProgressItem) => row.visa.signed ? tableDate(row.visa.signedAt) : null,
  };
  readonly labels = APP_LABELS;
  /** Preserve action buttons when the parent recomputes visa progression. */
  readonly trackProgressItem = (_index: number, progress: VisaProgressItem): string => progress.id;
  @Input({ required: true }) item: ValidationItem | null = null;
  @Input() canDelete = false;
  @Input() canSign = false;
  @Input() canSignItem: (item: ValidationItem) => boolean = () => false;
  @Input() canDeleteItem: (item: ValidationItem) => boolean = () => false;
  @Input() progressItems: VisaProgressItem[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() deleted = new EventEmitter<ValidationItem>();
  @Output() signed = new EventEmitter<ValidationItem>();

  /** Lifecycle information comes from the current aggregate refreshed by NgRx. */
  get sentToRhAt(): string | undefined {
    const source = this.item?.payload;
    return source && "sentToRhAt" in source ? source.sentToRhAt : undefined;
  }

  get treatedAt(): string | undefined {
    const source = this.item?.payload;
    return source && "treatedAt" in source ? source.treatedAt : undefined;
  }

  deleteVisa(): void {
    if (this.item) {
      this.deleted.emit(this.item);
    }
  }

  signVisa(): void {
    if (this.item && this.canSign) {
      this.signed.emit(this.item);
    }
  }

  deleteProgressVisa(progress: VisaProgressItem): void {
    if (progress.actionItem) {
      this.deleted.emit(progress.actionItem);
    }
  }

  signProgressVisa(progress: VisaProgressItem): void {
    if (progress.actionItem && this.canSignItem(progress.actionItem)) {
      this.signed.emit(progress.actionItem);
    }
  }

  canDeleteProgressVisa(progress: VisaProgressItem): boolean {
    return Boolean(progress.actionItem && this.canDeleteItem(progress.actionItem));
  }

  formatDateTime(value: string): string {
    if (!value) {
      return "-";
    }

    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  }
}
