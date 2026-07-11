import { Component, EventEmitter, Input, OnDestroy, Output } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { ModalComponent } from "../../shared/modal.component";
import { StoreUnsubscribe, appStore } from "../../store/app-store";
import { ExceptionalInterventionForm, ExceptionalOperation, SelectableUser } from "./exceptional.models";

@Component({
  selector: "app-intervention-modal",
  standalone: true,
  imports: [FormsModule, ModalComponent],
  templateUrl: "./intervention-modal.component.html",
  styleUrl: "./intervention-modal.component.css",
})
export class InterventionModalComponent implements OnDestroy {
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
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<ExceptionalInterventionForm>();

  users: SelectableUser[] = [];

  private readonly unsubscribe: StoreUnsubscribe = appStore.data.observeCollection<SelectableUser>(appStore.paths.users(), (documents) => {
    this.users = documents
        .map((document) => ({ ...document.data, id: document.id }) as SelectableUser)
      .filter((user) => Boolean(user.email))
      .sort((first, second) => this.userLabel(first).localeCompare(this.userLabel(second)));
  });

  ngOnDestroy(): void {
    this.unsubscribe();
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

  userLabel(user: SelectableUser): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
  }
}
