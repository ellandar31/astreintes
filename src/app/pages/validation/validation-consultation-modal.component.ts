import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ButtonModule } from "primeng/button";
import { TableModule } from "primeng/table";
import { TagModule } from "primeng/tag";
import { APP_LABELS } from "../../i18n/labels";
import { ModalComponent } from "../../shared/modal.component";
import { ValidationItem, VisaProgressItem } from "./validation.models";

@Component({
  selector: "app-validation-consultation-modal",
  standalone: true,
  imports: [ButtonModule, CommonModule, ModalComponent, TableModule, TagModule],
  templateUrl: "./validation-consultation-modal.component.html",
  styleUrl: "./validation-consultation-modal.component.css",
})
export class ValidationConsultationModalComponent {
  readonly labels = APP_LABELS;
  @Input({ required: true }) item: ValidationItem | null = null;
  @Input() canDelete = false;
  @Input() canDeleteItem: (item: ValidationItem) => boolean = () => false;
  @Input() progressItems: VisaProgressItem[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() deleted = new EventEmitter<ValidationItem>();
  @Output() signed = new EventEmitter<ValidationItem>();

  deleteVisa(): void {
    if (this.item) {
      this.deleted.emit(this.item);
    }
  }

  signVisa(): void {
    if (this.item) {
      this.signed.emit(this.item);
    }
  }

  deleteProgressVisa(progress: VisaProgressItem): void {
    if (progress.actionItem) {
      this.deleted.emit(progress.actionItem);
    }
  }

  signProgressVisa(progress: VisaProgressItem): void {
    if (progress.actionItem) {
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
