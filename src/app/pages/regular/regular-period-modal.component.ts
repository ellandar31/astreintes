import { TableColumnHeaderComponent } from "../../shared/table-column-header.component";
import { TableRowsPipe, tableDate } from "../../shared/table-rows.pipe";
import { isUserAssignable } from "../../shared/user-availability";
import { Direction } from "../../types";
import { TruncatedTextComponent } from "../../shared/truncated-text.component";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { InputTextModule } from "primeng/inputtext";
import { MessageModule } from "primeng/message";
import { SelectModule } from "primeng/select";
import { SharedTableModule } from "../../shared/shared-table.module";
import { APP_LABELS } from "../../i18n/labels";
import { ModalComponent } from "../../shared/modal.component";
import { RegularIntervention, RegularOnCallPeriodForm, RegularUser } from "./regular.models";

@Component({
  selector: "app-regular-period-modal",
  standalone: true,
  imports: [TableColumnHeaderComponent, TableRowsPipe, TruncatedTextComponent, ButtonModule, FormsModule, InputTextModule, MessageModule, ModalComponent, SelectModule, SharedTableModule],
  templateUrl: "./regular-period-modal.component.html",
  styleUrls: ["./regular-period-modal.component.css", "../../shared/user-select-form.css"],
})
export class RegularPeriodModalComponent {
  readonly interventionTableFields = {
    tableUser: (row: { userName: string; userEmail: string }) => row.userName || row.userEmail,
    tableStartDate: (row: { startDate: string }) => tableDate(row.startDate),
    tableEndDate: (row: { endDate: string }) => tableDate(row.endDate),
  };
  readonly labels = APP_LABELS;
  @Input() directions: Direction[] = [];
  @Input({ required: true }) form: RegularOnCallPeriodForm = {
    userId: "",
    userName: "",
    userEmail: "",
    startDate: "",
    endDate: "",
  };
  @Input() interventions: RegularIntervention[] = [];
  @Input() isEditing = false;
  @Input() isLocked = false;
  /** Planning permission is independent from the RH lock: own interventions remain editable. */
  @Input() planningReadOnly = false;
  @Input() canAddIntervention = true;
  @Input() canManageIntervention: (intervention: RegularIntervention) => boolean = () => true;
  @Input() sentToRhAt?: unknown;
  @Input({ required: true }) users: RegularUser[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() deleted = new EventEmitter<void>();
  @Output() interventionAdded = new EventEmitter<void>();
  @Output() interventionDeleted = new EventEmitter<RegularIntervention>();
  @Output() interventionEdited = new EventEmitter<RegularIntervention>();
  @Output() saved = new EventEmitter<RegularOnCallPeriodForm>();

  get modalTitle(): string {
    return this.isEditing ? this.labels.regular.modal.editPeriod : this.labels.regular.modal.addPeriod;
  }

  get startDateValue(): string {
    return this.isEditing ? this.form.startDate : this.toDateOnly(this.form.startDate);
  }

  get endDateValue(): string {
    return this.isEditing ? this.form.endDate : this.toDateOnly(this.form.endDate);
  }

  save(form: NgForm): void {
    if (this.isLocked || this.planningReadOnly) {
      return;
    }

    if (form.invalid || !this.form.directionId) {
      return;
    }

    if (!this.isEditing) {
      this.form.startDate = this.withDefaultTime(this.form.startDate, "18:00");
      this.form.endDate = this.withDefaultTime(this.form.endDate, "08:00");
    }

    this.saved.emit({ ...this.form });
  }

  /** Keep a historical selection visible, but disabled in the dropdown. */
  get assignableUsers() { return this.users.filter(user => isUserAssignable(user) || user.id === this.form.userId); }

  selectUser(userId: string): void {
    const selectedUser = this.users.find((user) => user.id === userId);

    if (!selectedUser || !isUserAssignable(selectedUser)) return;
    this.form.userId = userId;
    this.form.userName = selectedUser?.displayName || selectedUser?.email || "";
    this.form.userEmail = selectedUser?.email || "";
  }

  deletePeriod(): void {
    if (this.isLocked || this.planningReadOnly) {
      return;
    }

    this.deleted.emit();
  }

  deleteIntervention(intervention: RegularIntervention): void {
    if (this.isLocked || !this.canManageIntervention(intervention)) {
      return;
    }

    this.interventionDeleted.emit(intervention);
  }

  addIntervention(): void {
    if (this.isLocked || !this.canAddIntervention) {
      return;
    }

    this.interventionAdded.emit();
  }

  editIntervention(intervention: RegularIntervention): void {
    if (this.isLocked || !this.canManageIntervention(intervention)) {
      return;
    }

    this.interventionEdited.emit(intervention);
  }

  formatDateTime(value: unknown): string {
    const date = this.toDate(value);

    if (!date) {
      return "";
    }

    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  }

  formatSentToRhDate(value: unknown): string {
    return this.formatDateTime(value);
  }

  updateStartDate(value: string): void {
    this.form.startDate = this.isEditing ? value : this.withDefaultTime(value, "18:00");
  }

  updateEndDate(value: string): void {
    this.form.endDate = this.isEditing ? value : this.withDefaultTime(value, "08:00");
  }

  userLabel(user: RegularUser): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
  }

  private toDateOnly(value: string): string {
    return value.slice(0, 10);
  }

  private toDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
      return value.toDate();
    }

    if (typeof value === "object" && "seconds" in value && typeof value.seconds === "number") {
      const nanoseconds = "nanoseconds" in value && typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
      return new Date(value.seconds * 1000 + Math.floor(nanoseconds / 1000000));
    }

    return null;
  }

  private withDefaultTime(value: string, time: string): string {
    const date = this.toDateOnly(value);

    return date ? `${date}T${time}` : "";
  }
}
