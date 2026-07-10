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
    plannedUsers: [],
    actualUsers: [],
  };
  @Input() isLocked = false;
  @Input() operation: ExceptionalOperation | null = null;
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
  validationError = "";
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
    if (this.isLocked) {
      return;
    }

    this.validationError = "";

    if (form.invalid) {
      return;
    }

    const overlapError = this.participantOverlapError();

    if (overlapError) {
      this.validationError = overlapError;
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

  selectInitiator(userId: string): void {
    const selectedUser = this.users.find((user) => user.id === userId);

    this.form.initiatorUid = userId;
    this.form.initiatorName = selectedUser?.displayName || selectedUser?.email || "";
  }

  addParticipant(listName: "plannedUsers" | "actualUsers", userId: string): void {
    const user = this.users.find((item) => item.id === userId);

    if (!user) {
      return;
    }

    this.form[listName] = [
      ...this.form[listName],
      {
        userId: user.id,
        displayName: user.displayName || user.email,
        email: user.email,
        startDate: this.defaultParticipantStartDate(listName, user.id),
        endDate: this.defaultParticipantEndDate(listName, user.id),
        visa: this.createEmptyVisa(),
      },
    ];

    if (listName === "plannedUsers") {
      this.selectedPlannedUserId = "";
    } else {
      this.selectedActualUserId = "";
    }
  }

  removeParticipant(listName: "plannedUsers" | "actualUsers", index: number): void {
    this.form[listName] = this.form[listName].filter((_, currentIndex) => currentIndex !== index);
  }

  initializeActualFromPlanned(): void {
    if (this.form.actualUsers.length || !this.form.plannedUsers.length) {
      return;
    }

    this.form.actualUsers = this.form.plannedUsers.map((participant) => ({
      ...participant,
      visa: this.createEmptyVisa(),
    }));
    this.selectedActualUserId = "";
  }

  availableUsers(): SelectableUser[] {
    return this.users;
  }

  userLabel(user: SelectableUser): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
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

  private createEmptyVisa(): SignatureVisa {
    return createEmptyVisa();
  }

  private defaultParticipantStartDate(listName: "plannedUsers" | "actualUsers", userId: string): string {
    if (listName === "actualUsers") {
      const plannedParticipant = this.form.plannedUsers.find((participant) => participant.userId === userId);
      return plannedParticipant?.startDate || this.form.actualStartDate || this.form.startDate || "";
    }

    return this.form.startDate || "";
  }

  private defaultParticipantEndDate(listName: "plannedUsers" | "actualUsers", userId: string): string {
    if (listName === "actualUsers") {
      const plannedParticipant = this.form.plannedUsers.find((participant) => participant.userId === userId);
      return plannedParticipant?.endDate || this.form.actualEndDate || this.form.forecastEndDate || "";
    }

    return this.form.forecastEndDate || "";
  }

  private participantOverlapError(): string {
    return this.listOverlapError("plannedUsers", "prévisionnel") || this.listOverlapError("actualUsers", "réel");
  }

  private listOverlapError(listName: "plannedUsers" | "actualUsers", label: string): string {
    const participants = this.form[listName];

    for (let firstIndex = 0; firstIndex < participants.length; firstIndex += 1) {
      const first = participants[firstIndex];

      for (let secondIndex = firstIndex + 1; secondIndex < participants.length; secondIndex += 1) {
        const second = participants[secondIndex];

        if (first.userId !== second.userId) {
          continue;
        }

        if (this.dateRangesOverlap(first.startDate, first.endDate, second.startDate, second.endDate)) {
          return `Les périodes ${label} de ${first.displayName || first.email} se recouvrent.`;
        }
      }
    }

    return "";
  }

  private dateRangesOverlap(firstStart: string, firstEnd: string, secondStart: string, secondEnd: string): boolean {
    if (!firstStart || !firstEnd || !secondStart || !secondEnd) {
      return false;
    }

    return firstStart < secondEnd && secondStart < firstEnd;
  }
}
