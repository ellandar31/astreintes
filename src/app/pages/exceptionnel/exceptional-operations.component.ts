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
import {
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
  sortDirection: SortDirection = "asc";
  sortField: SortField = "startDate";
  operations: ExceptionalOperation[] = [];
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
      .map((document) => ({ id: document.id, ...document.data() }) as ExceptionalOperation)
      .sort((first, second) => (first.startDate || "").localeCompare(second.startDate || ""));
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
      initiatorName: operation.initiatorName,
      operationManagerName: operation.operationManagerName || "",
      title: operation.title,
      startDate: operation.startDate,
      forecastEndDate: operation.forecastEndDate || "",
      actualStartDate: operation.actualStartDate || "",
      actualEndDate: operation.actualEndDate || "",
      status: operation.status,
      plannedUsers: [...(operation.plannedUsers || [])],
      actualUsers: [...(operation.actualUsers || [])],
    };
    this.modalMode = "edit";
  }

  openInterventionModal(operation: ExceptionalOperation): void {
    this.selectedOperation = operation;
    this.interventionForm = {
      startDate: "",
      endDate: "",
      userId: "",
      userName: "",
      userEmail: "",
      wasOnSite: false,
      label: "",
      comment: "",
    };
    this.modalMode = "intervention";
  }

  closeModal(): void {
    this.modalMode = null;
    this.selectedOperation = null;
  }

  async saveOperation(form: ExceptionalOperationForm): Promise<void> {
    const payload = {
      ...form,
      initiatorUid: this.user?.uid || "",
      operationManagerUid: this.selectedOperation?.operationManagerUid || "",
      plannedUsers: form.plannedUsers || [],
      actualUsers: form.actualUsers || [],
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

    await setDoc(
      doc(db, "exceptionalOperations", this.selectedOperation.id),
      {
        interventions: [
          ...(this.selectedOperation.interventions || []),
          {
            startDate: form.startDate,
            date: form.startDate,
            endDate: form.endDate,
            userId: form.userId,
            userName: form.userName,
            userEmail: form.userEmail,
            wasOnSite: form.wasOnSite,
            agentVisa: this.createEmptyVisa(),
          },
        ],
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    this.closeModal();
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
      return "⇅";
    }

    return this.sortDirection === "asc" ? "↑" : "↓";
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

  private createEmptyOperationVisas() {
    return {
      plannedInitiator: this.createEmptyVisa(),
      plannedDirector: this.createEmptyVisa(),
      actualInitiator: this.createEmptyVisa(),
      actualDirector: this.createEmptyVisa(),
    };
  }

  private createEmptyVisa(): SignatureVisa {
    return {
      signed: false,
      signedAt: "",
      signedByName: "",
      signedByUid: "",
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
