import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { APP_LABELS } from "../../i18n/labels";
import { ModalComponent } from "../../shared/modal.component";
import { RhControlDetailItem, RhControlDetailLine } from "./rh-control-detail.models";

@Component({
  selector: "app-rh-control-detail-modal",
  standalone: true,
  imports: [CommonModule, ModalComponent],
  templateUrl: "./rh-control-detail-modal.component.html",
  styleUrl: "./rh-control-detail-modal.component.css",
})
export class RhControlDetailModalComponent {
  @Input({ required: true }) item!: RhControlDetailItem;
  @Output() closed = new EventEmitter<void>();
  readonly labels = APP_LABELS;

  formatLineTotal(line: RhControlDetailLine): string {
    return `${this.formatNumber(line.hours)} h x ${this.formatNumber(line.coefficient)}`;
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
  }
}
