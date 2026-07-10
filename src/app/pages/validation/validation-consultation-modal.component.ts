import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ModalComponent } from "../../shared/modal.component";
import { ValidationItem, VisaProgressItem } from "./validation.models";

@Component({
  selector: "app-validation-consultation-modal",
  standalone: true,
  imports: [CommonModule, ModalComponent],
  templateUrl: "./validation-consultation-modal.component.html",
  styleUrl: "./validation-consultation-modal.component.css",
})
export class ValidationConsultationModalComponent {
  @Input({ required: true }) item: ValidationItem | null = null;
  @Input() canDelete = false;
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

  formatDateTime(value: string): string {
    if (!value) {
      return "-";
    }

    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  }
}
