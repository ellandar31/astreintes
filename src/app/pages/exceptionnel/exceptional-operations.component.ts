import { CommonModule } from "@angular/common";
import { Component, Input, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { User } from "firebase/auth";
import {
  Unsubscribe,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { createEmptyVisa } from "../../shared/visa.models";
import {
  ExceptionalIntervention,
  ExceptionalInterventionForm,
  ExceptionalOperation,
  ExceptionalOperationForm,
  ExceptionalOperationStatus,
  ExceptionalOperationType,
  FilterField,
  ModalMode,
  OperationParticipant,
  SignatureVisa,
  SortDirection,
  SortField,
} from "./exceptional.models";
import { InterventionModalComponent } from "./intervention-modal.component";
import { OperationModalComponent } from "./operation-modal.component";

@Component({
  selector: "app-exceptional-operations",
  standalone: true,
  imports: [CommonModule, FormsModule, InterventionModalComponent, OperationModalComponent],
  templateUrl: "./exceptional-operations.component.html",
  styleUrl: "./exceptional-operations.component.css",
})
export class ExceptionalOperationsComponent implements OnDestroy {
  @Input({ required: true }) user: User | null = null;

  readonly statuses: ExceptionalOperationStatus[] = ["Brouillon", "Planifiée", "En cours", "Signé Agent", "Signé Directeur", "Terminée", "Annulée"];

  activeFilterField: FilterField = null;
  filters: Record<SortField, string> = {
    type: "",
    initiatorName: "",
    title: "",
    startDate: "",
    status: "",
  };
  selectedStatusFilters: ExceptionalOperationStatus[] = [];
  modalMode: ModalMode | null = null;
  selectedOperation: ExceptionalOperation | null = null;
  selectedInterventionIndex: number | null = null;
  shouldReturnToOperationModal = false;
  sortDirection: SortDirection = "asc";
  sortField: SortField = "startDate";
  operations: ExceptionalOperation[] = [];
  interventionError = "";
  operationForm = this.createEmptyOperationForm("astreinte");
  interventionForm = {
    startDate: "",
    endDate: "",
    userId: "",
    userName: "",
    userEmail: "",
    wasOnSite: false,
    label: "",
    comment: "",
  };

  private readonly unsubscribe: Unsubscribe = onSnapshot(collection(db, "exceptionalOperations"), (snapshot) => {
    this.operations = snapshot.docs
      .map((document) => this.normalizeOperation({ id: document.id, ...document.data() } as ExceptionalOperation))
      .sort((first, second) => (first.startDate || "").localeCompare(second.startDate || ""));

    if (this.selectedOperation) {
      this.selectedOperation =
        this.operations.find((operation) => operation.id === this.selectedOperation?.id) || this.selectedOperation;
    }
  });

  ngOnDestroy(): void {
    this.unsubscribe();
  }

  get filteredOperations(): ExceptionalOperation[] {
    return this.operations
      .filter((operation) => {
        return (
          this.matchesFilter(operation.type, this.filters.type) &&
          this.matchesFilter(operation.initiatorName, this.filters.initiatorName) &&
          this.matchesFilter(operation.title, this.filters.title) &&
          this.matchesFilter(this.formatDate(operation.startDate), this.filters.startDate) &&
          this.matchesStatusFilter(operation.status)
        );
      })
      .sort((first, second) => this.compareOperations(first, second));
  }

  openCreateModal(type: ExceptionalOperationType): void {
    this.selectedOperation = null;
    this.operationForm = this.createEmptyOperationForm(type);
    this.modalMode = type === "astreinte" ? "create-astreinte" : "create-travaux";
  }

  openEditModal(operation: ExceptionalOperation): void {
    this.selectedOperation = operation;
    this.operationForm = {
      type: operation.type,
      initiatorUid: operation.initiatorUid || "",
      initiatorName: operation.initiatorName,
      operationManagerName: operation.operationManagerName || "",
      title: operation.title,
      startDate: operation.startDate,
      forecastEndDate: operation.forecastEndDate || "",
      actualStartDate: operation.actualStartDate || "",
      actualEndDate: operation.actualEndDate || "",
      status: operation.status,
      plannedUsers: this.normalizeParticipants(operation.plannedUsers || [], operation.startDate, operation.forecastEndDate || operation.startDate),
      actualUsers: this.normalizeParticipants(
        operation.actualUsers || [],
        operation.actualStartDate || operation.startDate,
        operation.actualEndDate || operation.forecastEndDate || operation.startDate,
      ),
    };
    this.modalMode = "edit";
  }

  openInterventionModal(
    operation: ExceptionalOperation,
    intervention?: ExceptionalIntervention,
    index?: number,
    returnToOperationModal = false,
  ): void {
    this.selectedOperation = operation;
    this.selectedInterventionIndex = typeof index === "number" ? index : null;
    this.shouldReturnToOperationModal = returnToOperationModal;
    this.interventionError = "";
    this.interventionForm = intervention
      ? {
          startDate: intervention.startDate || intervention.date || "",
          endDate: intervention.endDate || "",
          userId: intervention.userId || "",
          userName: intervention.userName || "",
          userEmail: intervention.userEmail || "",
          wasOnSite: Boolean(intervention.wasOnSite),
          label: intervention.label || "",
          comment: intervention.comment || "",
        }
      : this.createEmptyInterventionForm();
    this.modalMode = "intervention";
  }

  closeModal(): void {
    this.modalMode = null;
    this.selectedOperation = null;
    this.selectedInterventionIndex = null;
    this.shouldReturnToOperationModal = false;
    this.interventionError = "";
  }

  closeInterventionModal(): void {
    this.selectedInterventionIndex = null;
    this.interventionError = "";

    if (this.shouldReturnToOperationModal && this.selectedOperation) {
      this.modalMode = "edit";
      this.shouldReturnToOperationModal = false;
      return;
    }

    this.closeModal();
  }

  async saveOperation(form: ExceptionalOperationForm): Promise<void> {
    const plannedUsers = this.normalizeParticipants(form.plannedUsers || [], form.startDate, form.forecastEndDate || form.startDate);
    const actualUsers = this.normalizeParticipants(
      form.actualUsers || [],
      form.actualStartDate || form.startDate,
      form.actualEndDate || form.forecastEndDate || form.startDate,
    );
    const plannedRange = this.participantRange(plannedUsers);
    const actualRange = this.participantRange(actualUsers);
    const payload = {
      ...form,
      initiatorUid: form.initiatorUid || "",
      operationManagerUid: this.selectedOperation?.operationManagerUid || "",
      startDate: plannedRange.startDate || form.startDate || "",
      forecastEndDate: plannedRange.endDate || form.forecastEndDate || "",
      actualStartDate: actualRange.startDate || form.actualStartDate || "",
      actualEndDate: actualRange.endDate || form.actualEndDate || "",
      plannedUsers,
      actualUsers,
      visas: this.selectedOperation?.visas || this.createEmptyOperationVisas(),
      interventions: this.selectedOperation?.interventions || [],
      updatedAt: serverTimestamp(),
    };

    if (this.selectedOperation) {
      await setDoc(doc(db, "exceptionalOperations", this.selectedOperation.id), payload, { merge: true });
    } else {
      await addDoc(collection(db, "exceptionalOperations"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }

    this.closeModal();
  }

  async deleteOperation(operation: ExceptionalOperation): Promise<void> {
    await deleteDoc(doc(db, "exceptionalOperations", operation.id));
  }

  async saveIntervention(form: ExceptionalInterventionForm): Promise<void> {
    if (!this.selectedOperation) {
      return;
    }

    this.interventionError = "";

    const interventionValidationError = this.validateIntervention(form, this.selectedOperation);

    if (interventionValidationError) {
      this.interventionError = interventionValidationError;
      return;
    }

    const interventionPayload = {
      startDate: form.startDate,
      date: form.startDate,
      endDate: form.endDate,
      userId: form.userId,
      userName: form.userName,
      userEmail: form.userEmail,
      wasOnSite: form.wasOnSite,
      agentVisa:
        this.selectedInterventionIndex !== null
          ? this.selectedOperation.interventions[this.selectedInterventionIndex]?.agentVisa || this.createEmptyVisa()
          : this.createEmptyVisa(),
      label: form.label.trim(),
      comment: form.comment.trim(),
    };
    const interventions = [...(this.selectedOperation.interventions || [])];

    if (this.selectedInterventionIndex !== null) {
      interventions[this.selectedInterventionIndex] = interventionPayload;
    } else {
      interventions.push(interventionPayload);
    }

    await setDoc(
      doc(db, "exceptionalOperations", this.selectedOperation.id),
      {
        interventions,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    this.selectedOperation = {
      ...this.selectedOperation,
      interventions,
    };
    this.closeInterventionModal();
  }

  async deleteIntervention(operation: ExceptionalOperation, index: number): Promise<void> {
    const currentOperation = this.operations.find((item) => item.id === operation.id) || operation;
    const interventions = [...(currentOperation.interventions || [])];

    if (index < 0 || index >= interventions.length) {
      return;
    }

    interventions.splice(index, 1);

    await setDoc(
      doc(db, "exceptionalOperations", currentOperation.id),
      {
        interventions,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    if (this.selectedOperation?.id === currentOperation.id) {
      this.selectedOperation = {
        ...this.selectedOperation,
        interventions,
      };
    }
  }

  setSort(field: SortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
      return;
    }

    this.sortField = field;
    this.sortDirection = "asc";
  }

  sortIndicator(field: SortField): string {
    if (this.sortField !== field) {
      return "â‡…";
    }

    return this.sortDirection === "asc" ? "â†‘" : "â†“";
  }

  toggleFilter(field: SortField): void {
    this.activeFilterField = this.activeFilterField === field ? null : field;
  }

  clearFilter(field: SortField): void {
    this.filters[field] = "";

    if (field === "status") {
      this.selectedStatusFilters = [];
    }
  }

  toggleStatusFilter(status: ExceptionalOperationStatus): void {
    if (this.selectedStatusFilters.includes(status)) {
      this.selectedStatusFilters = this.selectedStatusFilters.filter((currentStatus) => currentStatus !== status);
      return;
    }

    this.selectedStatusFilters = [...this.selectedStatusFilters, status];
  }

  isStatusFilterSelected(status: ExceptionalOperationStatus): boolean {
    return this.selectedStatusFilters.includes(status);
  }

  operationTypeLabel(type: ExceptionalOperationType): string {
    return type === "astreinte" ? "Astreinte exceptionnelle" : "Travail exceptionnel";
  }

  formatDate(value: string): string {
    if (!value) {
      return "";
    }

    const [date] = value.split("T");
    return date || value;
  }

  private createEmptyOperationForm(type: ExceptionalOperationType) {
    return {
      type,
      initiatorUid: this.user?.uid || "",
      initiatorName: this.user?.displayName || this.user?.email || "Utilisateur",
      operationManagerName: "",
      title: "",
      startDate: "",
      forecastEndDate: "",
      actualStartDate: "",
      actualEndDate: "",
      status: "Brouillon" as ExceptionalOperationStatus,
      plannedUsers: [] as OperationParticipant[],
      actualUsers: [] as OperationParticipant[],
    };
  }

  private createEmptyInterventionForm(): ExceptionalInterventionForm {
    return {
      startDate: "",
      endDate: "",
      userId: "",
      userName: "",
      userEmail: "",
      wasOnSite: false,
      label: "",
      comment: "",
    };
  }

  private createEmptyOperationVisas() {
    return {
      initiatorGlobal: createEmptyVisa(),
      directorGlobal: createEmptyVisa(),
      plannedInitiator: createEmptyVisa(),
      plannedDirector: createEmptyVisa(),
      actualInitiator: createEmptyVisa(),
      actualDirector: createEmptyVisa(),
    };
  }

  private createEmptyVisa(): SignatureVisa {
    return createEmptyVisa();
  }

  private validateIntervention(form: ExceptionalInterventionForm, operation: ExceptionalOperation): string {
    if (form.endDate <= form.startDate) {
      return "La date de fin doit être postérieure à la date de début.";
    }

    const matchingActualPeriod = (operation.actualUsers || []).find(
      (participant) =>
        this.matchesUser(participant.userId, participant.email, form.userId, form.userEmail) &&
        participant.startDate <= form.startDate &&
        participant.endDate >= form.endDate,
    );

    if (matchingActualPeriod) {
      return "";
    }

    return "L'intervention doit être entièrement comprise dans une période réelle de cet utilisateur.";
  }

  private matchesUser(userId: string | undefined, email: string | undefined, selectedId: string, selectedEmail: string): boolean {
    return Boolean(userId && userId === selectedId) || Boolean(email && selectedEmail && email === selectedEmail);
  }

  private normalizeOperation(operation: ExceptionalOperation): ExceptionalOperation {
    const plannedUsers = this.normalizeParticipants(operation.plannedUsers || [], operation.startDate, operation.forecastEndDate || operation.startDate);
    const actualUsers = this.normalizeParticipants(
      operation.actualUsers || [],
      operation.actualStartDate || operation.startDate,
      operation.actualEndDate || operation.forecastEndDate || operation.startDate,
    );
    const plannedRange = this.participantRange(plannedUsers);
    const actualRange = this.participantRange(actualUsers);

    return {
      ...operation,
      startDate: operation.startDate || plannedRange.startDate,
      forecastEndDate: operation.forecastEndDate || plannedRange.endDate,
      actualStartDate: operation.actualStartDate || actualRange.startDate,
      actualEndDate: operation.actualEndDate || actualRange.endDate,
      plannedUsers,
      actualUsers,
    };
  }

  private normalizeParticipants(
    participants: OperationParticipant[],
    fallbackStartDate: string,
    fallbackEndDate: string,
  ): OperationParticipant[] {
    return participants.map((participant) => ({
      ...participant,
      startDate: participant.startDate || fallbackStartDate || "",
      endDate: participant.endDate || fallbackEndDate || "",
      visa: participant.visa || this.createEmptyVisa(),
    }));
  }

  private participantRange(participants: OperationParticipant[]): { startDate: string; endDate: string } {
    const startDates = participants.map((participant) => participant.startDate).filter(Boolean).sort();
    const endDates = participants.map((participant) => participant.endDate).filter(Boolean).sort();

    return {
      startDate: startDates[0] || "",
      endDate: endDates.at(-1) || "",
    };
  }

  private compareOperations(first: ExceptionalOperation, second: ExceptionalOperation): number {
    const firstValue = String(first[this.sortField] || "").toLowerCase();
    const secondValue = String(second[this.sortField] || "").toLowerCase();
    const result = firstValue.localeCompare(secondValue);

    return this.sortDirection === "asc" ? result : -result;
  }

  private matchesFilter(value: string, filter: string): boolean {
    const normalizedFilter = filter.trim().toLowerCase();

    if (!normalizedFilter) {
      return true;
    }

    return value.toLowerCase().includes(normalizedFilter);
  }

  private matchesStatusFilter(status: ExceptionalOperationStatus): boolean {
    if (!this.selectedStatusFilters.length) {
      return true;
    }

    return this.selectedStatusFilters.includes(status);
  }
}
