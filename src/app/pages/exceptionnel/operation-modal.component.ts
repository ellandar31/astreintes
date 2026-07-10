import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnDestroy, Output } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { Unsubscribe, collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { ModalComponent } from "../../shared/modal.component";
import { createEmptyVisa } from "../../shared/visa.models";
import {
  ExceptionalIntervention,
  ExceptionalOperation,
  ExceptionalOperationForm,
  ExceptionalOperationStatus,
  OperationParticipant,
  SelectableUser,
  SignatureVisa,
} from "./exceptional.models";

@Component({
  selector: "app-operation-modal",
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: "./operation-modal.component.html",
  styleUrl: "./operation-modal.component.css",
})
export class OperationModalComponent implements OnDestroy {
  @Input({ required: true }) form: ExceptionalOperationForm = {
    type: "astreinte",
    initiatorUid: "",
    initiatorName: "",
    operationManagerName: "",
    title: "",
    startDate: "",
    forecastEndDate: "",
    actualStartDate: "",
    actualEndDate: "",
    status: "Brouillon",
    plannedUsers: [],
    actualUsers: [],
  };
  @Input() operation: ExceptionalOperation | null = null;
  @Input({ required: true }) statuses: ExceptionalOperationStatus[] = [];
  @Output() addIntervention = new EventEmitter<ExceptionalOperation>();
  @Output() closed = new EventEmitter<void>();
  @Output() deleteIntervention = new EventEmitter<{ operation: ExceptionalOperation; index: number }>();
  @Output() editIntervention = new EventEmitter<{
    operation: ExceptionalOperation;
    intervention: ExceptionalIntervention;
    index: number;
  }>();
  @Output() saved = new EventEmitter<ExceptionalOperationForm>();

  selectedActualUserId = "";
  selectedPlannedUserId = "";
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

  get title(): string {
    return this.operation ? "Modifier l'opération" : this.operationTypeLabel(this.form.type);
  }

  save(form: NgForm): void {
    if (form.invalid) {
      return;
    }

    this.saved.emit({ ...this.form });
  }

  operationTypeLabel(type: ExceptionalOperationForm["type"]): string {
    return type === "astreinte" ? "Astreinte exceptionnelle" : "Travail exceptionnel";
  }

  formatDate(value: string | undefined): string {
    if (!value) {
      return "";
    }

    const [date] = value.split("T");
    return date || value;
  }

  selectInitiator(userId: string): void {
    const selectedUser = this.users.find((user) => user.id === userId);

    this.form.initiatorUid = userId;
    this.form.initiatorName = selectedUser?.displayName || selectedUser?.email || "";
  }

  addParticipant(listName: "plannedUsers" | "actualUsers", userId: string): void {
    const user = this.users.find((item) => item.id === userId);

    if (!user || this.form[listName].some((participant) => participant.userId === user.id)) {
      return;
    }

    this.form[listName] = [
      ...this.form[listName],
      {
        userId: user.id,
        displayName: user.displayName || user.email,
        email: user.email,
        visa: this.createEmptyVisa(),
      },
    ];

    if (listName === "plannedUsers") {
      this.selectedPlannedUserId = "";
    } else {
      this.selectedActualUserId = "";
    }
  }

  removeParticipant(listName: "plannedUsers" | "actualUsers", participant: OperationParticipant): void {
    this.form[listName] = this.form[listName].filter((item) => item.userId !== participant.userId);
  }

  availableUsers(listName: "plannedUsers" | "actualUsers"): SelectableUser[] {
    return this.users.filter((user) => !this.form[listName].some((participant) => participant.userId === user.id));
  }

  userLabel(user: SelectableUser): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
  }

  private createEmptyVisa(): SignatureVisa {
    return createEmptyVisa();
  }
}
