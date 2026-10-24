import { isUserAssignable } from "../../shared/user-availability";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { CheckboxModule } from "primeng/checkbox";
import { InputTextModule } from "primeng/inputtext";
import { MessageModule } from "primeng/message";
import { SelectModule } from "primeng/select";
import { APP_LABELS } from "../../i18n/labels";
import { TruncatedTextComponent } from "../../shared/truncated-text.component";
import { ModalComponent } from "../../shared/modal.component";
import { ExceptionalInterventionForm, ExceptionalOperation, SelectableUser } from "./exceptional.models";

@Component({
  selector: "app-intervention-modal",
  standalone: true,
  imports: [ButtonModule, CheckboxModule, FormsModule, InputTextModule, MessageModule, ModalComponent, TruncatedTextComponent, SelectModule],
  templateUrl: "./intervention-modal.component.html",
  styleUrls: ["./intervention-modal.component.css", "../../shared/user-select-form.css"],
})
export class InterventionModalComponent {
  readonly labels = APP_LABELS;
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

  /** Keep a historical selection visible, but disabled in the dropdown. */
  get assignableUsers() { return this.users.filter(user => isUserAssignable(user) || user.id === this.form.userId); }

  selectUser(userId: string): void {
    const selectedUser = this.users.find((user) => user.id === userId);

    if (!selectedUser || !isUserAssignable(selectedUser)) return;
    this.form.userId = userId;
    this.form.userName = selectedUser?.displayName || selectedUser?.email || "";
    this.form.userEmail = selectedUser?.email || "";
  }

  userLabel(user: SelectableUser): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
  }
}
