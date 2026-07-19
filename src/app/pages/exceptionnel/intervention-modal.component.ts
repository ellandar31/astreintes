import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { ModalComponent } from "../../shared/modal.component";
import { ExceptionalInterventionForm, ExceptionalOperation, SelectableUser } from "./exceptional.models";

@Component({
  selector: "app-intervention-modal",
  standalone: true,
  imports: [FormsModule, ModalComponent],
  templateUrl: "./intervention-modal.component.html",
  styleUrl: "./intervention-modal.component.css",
})
export class InterventionModalComponent {
  @Input({ required: true }) form: ExceptionalInterventionForm = {
    startDate: "",
    endDate: "",
    userId: "",
    userName: "",
    userEmail: "",
    wasOnSite: false,
    label: "",
    comment: "",
  };
  @Input() error = "";
  @Input({ required: true }) operation: ExceptionalOperation | null = null;
  @Input() users: SelectableUser[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<ExceptionalInterventionForm>();

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

  userLabel(user: SelectableUser): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
  }
}
