import { Component, EventEmitter, Input, OnDestroy, Output } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { Unsubscribe, collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { ModalComponent } from "../../shared/modal.component";
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
  };
  @Input({ required: true }) operation: ExceptionalOperation | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<ExceptionalInterventionForm>();

  users: SelectableUser[] = [];

  private readonly unsubscribe: Unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
    this.users = snapshot.docs
      .map((document) => ({ id: document.id, ...document.data() }) as SelectableUser)
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
