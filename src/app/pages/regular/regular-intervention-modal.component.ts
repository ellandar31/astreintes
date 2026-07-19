import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { InputTextModule } from "primeng/inputtext";
import { MessageModule } from "primeng/message";
import { SelectModule } from "primeng/select";
import { APP_LABELS } from "../../i18n/labels";
import { ModalComponent } from "../../shared/modal.component";
import { RegularInterventionForm, RegularUser } from "./regular.models";

@Component({
  selector: "app-regular-intervention-modal",
  standalone: true,
  imports: [ButtonModule, FormsModule, InputTextModule, MessageModule, ModalComponent, SelectModule],
  templateUrl: "./regular-intervention-modal.component.html",
  styleUrl: "./regular-intervention-modal.component.css",
})
export class RegularInterventionModalComponent {
  readonly labels = APP_LABELS;
  @Input({ required: true }) form: RegularInterventionForm = {
    userId: "",
    userName: "",
    userEmail: "",
    startDate: "",
    endDate: "",
    comment: "",
  };
  @Input() error = "";
  @Input() isEditing = false;
  @Input({ required: true }) users: RegularUser[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<RegularInterventionForm>();

  get modalTitle(): string {
    return this.isEditing ? this.labels.regular.modal.editIntervention : this.labels.regular.modal.addIntervention;
  }

  save(form: NgForm): void {
    if (form.invalid) {
      return;
    }

    this.saved.emit({ ...this.form });
  }

  selectUser(userId: string): void {
    const selectedUser = this.users.find((user) => user.id === userId);

    this.form.userId = userId;
    this.form.userName = selectedUser?.displayName || selectedUser?.email || "";
    this.form.userEmail = selectedUser?.email || "";
  }

  userLabel(user: RegularUser): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
  }
}
