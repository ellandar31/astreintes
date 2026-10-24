import { TableColumnHeaderComponent } from "../../shared/table-column-header.component";
import { TableRowsPipe, tableDate } from "../../shared/table-rows.pipe";
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { TableModule } from "primeng/table";
import { APP_LABELS } from "../../i18n/labels";
import { ModalComponent } from "../../shared/modal.component";
import { TruncatedTextComponent } from "../../shared/truncated-text.component";
import { HistoryDetailItem, HistoryDetailLine } from "./history.models";

@Component({
  selector: "app-history-detail-modal",
  standalone: true,
  imports: [TableColumnHeaderComponent, TableRowsPipe, CommonModule, ModalComponent, TableModule, TruncatedTextComponent],
  templateUrl: "./history-detail-modal.component.html",
  styleUrl: "./history-detail-modal.component.css",
})
export class HistoryDetailModalComponent {
  readonly detailTableFields = {
    tablePeriodDate: (row: HistoryDetailLine) => tableDate(row.period),
    tableTotal: (row: HistoryDetailLine) => row.hours * row.coefficient,
  };
  @Input({ required: true }) item!: HistoryDetailItem;
  @Output() closed = new EventEmitter<void>();
  readonly labels = APP_LABELS;

  formatLineTotal(line: HistoryDetailLine): string {
    return `${this.formatNumber(line.hours)} h x ${this.formatNumber(line.coefficient)}`;
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
  }
}
