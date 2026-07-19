import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, OnDestroy, SimpleChanges, effect, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Store } from "@ngrx/store";
import { APP_LABELS } from "../../i18n/labels";
import { SignatureVisa, createEmptyVisa } from "../../shared/visa.models";
import { ExceptionalActions } from "../../state/exceptional/exceptional.actions";
import {
  selectExceptionalError,
  selectExceptionalOperations,
} from "../../state/exceptional/exceptional.selectors";
import { RegularActions } from "../../state/regular/regular.actions";
import {
  selectRegularError,
  selectRegularInterventions,
  selectRegularPeriods,
} from "../../state/regular/regular.selectors";
import { SettingsActions } from "../../state/settings/settings.actions";
import { selectSettingsMessage, selectSettingsUsers } from "../../state/settings/settings.selectors";
import { StoreAuthUser } from "../../store/app-store";
import { ExceptionalOperation } from "../exceptionnel/exceptional.models";
import { RegularIntervention, RegularOnCallPeriod } from "../regular/regular.models";
import { ValidationConsultationModalComponent } from "./validation-consultation-modal.component";
import { AppUser, ValidationItem, ValidationSection, ValidationSectionId, VisaProgressItem } from "./validation.models";

@Component({
  selector: "app-validation-page",
  standalone: true,
  imports: [CommonModule, FormsModule, ValidationConsultationModalComponent],
  templateUrl: "./validation-page.component.html",
  styleUrl: "./validation-page.component.css",
})
export class ValidationPageComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) user: StoreAuthUser | null = null;
  readonly labels = APP_LABELS;

  exceptionalOperations: ExceptionalOperation[] = [];
  profile: AppUser | null = null;
  regularInterventions: RegularIntervention[] = [];
  regularPeriods: RegularOnCallPeriod[] = [];
  selectedItem: ValidationItem | null = null;
  activeSectionId: ValidationSectionId = "stakeholder";
  selectedUserId = "";
  users: AppUser[] = [];
  validationMessage = "";
  readonly canDeleteVisaForModal = (item: ValidationItem): boolean => this.canDeleteVisa(item);

  private readonly store = inject(Store);
  private readonly exceptionalError = this.store.selectSignal(selectExceptionalError);
  private readonly exceptionalOperationsSignal = this.store.selectSignal(selectExceptionalOperations);
  private readonly regularError = this.store.selectSignal(selectRegularError);
  private readonly regularInterventionsSignal = this.store.selectSignal(selectRegularInterventions);
  private readonly regularPeriodsSignal = this.store.selectSignal(selectRegularPeriods);
  private readonly settingsMessage = this.store.selectSignal(selectSettingsMessage);
  private readonly settingsUsers = this.store.selectSignal(selectSettingsUsers);

  constructor() {
    this.store.dispatch(SettingsActions.usersWatchStarted());
    this.store.dispatch(RegularActions.watchStarted());
    this.store.dispatch(ExceptionalActions.watchStarted());

    effect(() => {
      this.users = [...this.settingsUsers()]
        .filter((item) => Boolean(item.email))
        .sort((first, second) => this.userLabel(first).localeCompare(this.userLabel(second))) as AppUser[];
      this.refreshProfile();
    });

    effect(() => {
      this.regularPeriods = this.regularPeriodsSignal();
    });

    effect(() => {
      this.regularInterventions = this.regularInterventionsSignal();
    });

    effect(() => {
      this.exceptionalOperations = this.exceptionalOperationsSignal();
    });

    effect(() => {
      const error = this.regularError() || this.exceptionalError();

      if (error) {
        this.validationMessage = error;
      }
    });

    effect(() => {
      const message = this.settingsMessage();

      if (message?.kind === "failure" && message.source === "users") {
        this.validationMessage = message.message;
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes["user"]) {
      return;
    }

    this.selectedUserId = this.user?.uid || "";
    this.refreshProfile();
  }

  ngOnDestroy(): void {
    this.store.dispatch(SettingsActions.usersWatchStopped());
    this.store.dispatch(RegularActions.watchStopped());
    this.store.dispatch(ExceptionalActions.watchStopped());
  }

  get canSelectUser(): boolean {
    return this.isAdmin;
  }

  get isAdmin(): boolean {
    return Number(this.profile?.role) === 0;
  }

  get canViewInitiatorSection(): boolean {
    return this.isAdmin || Number(this.profile?.role) === 2;
  }

  get canViewDirectorSection(): boolean {
    return this.isAdmin || Number(this.profile?.role) === 3;
  }

  get selectedUser(): AppUser | undefined {
    return this.users.find((item) => item.id === this.selectedUserId || item.uid === this.selectedUserId);
  }

  get validationItems(): ValidationItem[] {
    const selectedId = this.selectedUserId || this.user?.uid || "";
    const selectedEmail = this.selectedUser?.email || this.user?.email || "";
    const items: ValidationItem[] = [];

    this.regularPeriods.forEach((period) => {
      if (this.matchesUser(period.userId, period.userEmail, selectedId, selectedEmail)) {
        items.push({
          id: `regular-period-agent-${period.id}`,
          kind: "regular-period-agent",
          category: this.labels.validation.categories.regularOnCall,
          title: period.userName || period.userEmail,
          userLabel: period.userName || period.userEmail,
          startDate: period.startDate,
          endDate: period.endDate,
          isGlobalAction: true,
          visa: period.agentVisa || createEmptyVisa(),
          payload: period,
        });
      }

      if (this.canViewDirectorSection && this.isRegularPeriodReadyForDirector(period)) {
        items.push({
          id: `regular-period-director-${period.id}`,
          kind: "regular-period-director",
          category: this.labels.validation.categories.regularOnCallDirectorVisa,
          title: period.userName || period.userEmail,
          userLabel: period.userName || period.userEmail,
          startDate: period.startDate,
          endDate: period.endDate,
          visa: period.directorVisa || createEmptyVisa(),
          payload: period,
        });
      }
    });


    this.exceptionalOperations.forEach((operation) => {
      if (this.matchesUser(operation.initiatorUid, operation.initiatorName, selectedId, selectedEmail)) {
        items.push(this.operationGlobalItem(operation, "exceptional-operation-initiator"));
      }

      if (this.canViewDirectorSection && this.isExceptionalOperationReadyForDirector(operation)) {
        items.push(this.operationGlobalItem(operation, "exceptional-operation-director"));
      }

      const userOperationItem = this.exceptionalOperationAgentItem(operation, selectedId, selectedEmail);

      if (userOperationItem) {
        items.push(userOperationItem);
      }

    });

    return items.sort((first, second) => (first.startDate || "").localeCompare(second.startDate || ""));
  }

  get intervenantVisaItems(): ValidationItem[] {
    return this.validationItems.filter((item) =>
      [
        "regular-period-agent",
        "exceptional-operation-agent",
      ].includes(item.kind),
    );
  }

  get initiatorVisaItems(): ValidationItem[] {
    if (!this.canViewInitiatorSection) {
      return [];
    }

    return this.validationItems.filter((item) => item.kind === "exceptional-operation-initiator");
  }

  get directorVisaItems(): ValidationItem[] {
    if (!this.canViewDirectorSection) {
      return [];
    }

    return this.validationItems.filter((item) =>
      ["regular-period-director", "exceptional-operation-director"].includes(item.kind),
    );
  }

  get validationSections(): ValidationSection[] {
    const sections: ValidationSection[] = [
      {
        id: "stakeholder",
        title: this.labels.validation.sections.stakeholder,
        emptyText: this.labels.validation.empty.stakeholder,
        items: this.intervenantVisaItems,
      },
    ];

    if (this.canViewInitiatorSection) {
      sections.push({
        id: "initiator",
        title: this.labels.validation.sections.initiator,
        emptyText: this.labels.validation.empty.initiator,
        items: this.initiatorVisaItems,
      });
    }

    if (this.canViewDirectorSection) {
      sections.push({
        id: "director",
        title: this.labels.validation.sections.director,
        emptyText: this.labels.validation.empty.director,
        items: this.directorVisaItems,
      });
    }

    return sections;
  }

  get activeValidationSection(): ValidationSection {
    return this.validationSections.find((section) => section.id === this.activeSectionId) || this.validationSections[0];
  }

  selectSection(sectionId: ValidationSectionId): void {
    this.activeSectionId = sectionId;
  }

  get selectedItemVisaProgress(): VisaProgressItem[] {
    if (!this.selectedItem) {
      return [];
    }

    if (this.isRegularPayload(this.selectedItem.payload)) {
      const payload = this.selectedItem.payload;
      const period =
        "periodId" in payload
          ? this.regularPeriods.find((item) => item.id === payload.periodId)
          : payload;

      if (!period) {
        return [];
      }

      const interventions = this.regularInterventions.filter((intervention) => intervention.periodId === period.id);

      return [
        {
          id: `regular-period-agent-${period.id}`,
          role: this.labels.validation.roles.regularOnCallStakeholder,
          userLabel: period.userName || period.userEmail,
          startDate: period.startDate,
          endDate: period.endDate,
          visa: period.agentVisa || createEmptyVisa(),
          actionItem: {
            id: `regular-period-agent-${period.id}`,
            kind: "regular-period-agent",
            category: this.labels.validation.categories.regularOnCall,
            title: period.userName || period.userEmail,
            userLabel: period.userName || period.userEmail,
            startDate: period.startDate,
            endDate: period.endDate,
            visa: period.agentVisa || createEmptyVisa(),
            payload: period,
          },
        },
        {
          id: `regular-period-director-${period.id}`,
          role: this.labels.validation.roles.directorOnCall,
          userLabel: this.labels.validation.roles.director,
          startDate: period.startDate,
          endDate: period.endDate,
          visa: period.directorVisa || createEmptyVisa(),
          actionItem: {
            id: `regular-period-director-${period.id}`,
            kind: "regular-period-director",
            category: this.labels.validation.categories.regularOnCallDirectorVisa,
            title: period.userName || period.userEmail,
            userLabel: period.userName || period.userEmail,
            startDate: period.startDate,
            endDate: period.endDate,
            visa: period.directorVisa || createEmptyVisa(),
            payload: period,
          },
        },
        ...interventions.map((intervention) => ({
          id: `regular-intervention-${intervention.id}`,
          role: this.labels.validation.roles.interventionStakeholder,
          userLabel: intervention.userName || intervention.userEmail,
          startDate: intervention.startDate,
          endDate: intervention.endDate,
          visa: intervention.agentVisa || createEmptyVisa(),
          actionItem: {
            id: `regular-intervention-${intervention.id}`,
            kind: "regular-intervention-agent" as const,
            category: this.labels.common.fields.intervention,
            title: period.userName || period.userEmail,
            userLabel: intervention.userName || intervention.userEmail,
            startDate: intervention.startDate,
            endDate: intervention.endDate,
            visa: intervention.agentVisa || createEmptyVisa(),
            payload: intervention,
          },
        })),
      ];
    }

    const operation = this.selectedItem.payload as ExceptionalOperation;

    return [
      {
        id: `exceptional-operation-initiator-${operation.id}`,
        role: this.labels.validation.roles.initiator,
        userLabel: operation.initiatorName || this.labels.validation.roles.initiator,
        startDate: operation.startDate,
        endDate: operation.actualEndDate || operation.forecastEndDate || operation.startDate,
        visa: operation.visas?.initiatorGlobal || operation.visas?.actualInitiator || createEmptyVisa(),
        actionItem: this.operationGlobalItem(operation, "exceptional-operation-initiator"),
      },
      {
        id: `exceptional-operation-director-${operation.id}`,
        role: this.labels.validation.roles.director,
        userLabel: this.labels.validation.roles.director,
        startDate: operation.startDate,
        endDate: operation.actualEndDate || operation.forecastEndDate || operation.startDate,
        visa: operation.visas?.directorGlobal || operation.visas?.actualDirector || createEmptyVisa(),
        actionItem: this.operationGlobalItem(operation, "exceptional-operation-director"),
      },
      ...(operation.plannedUsers || []).map((participant, index) => ({
        id: `exceptional-planned-${operation.id}-${participant.userId}-${index}`,
        role: this.labels.validation.roles.plannedStakeholder,
        userLabel: participant.displayName || participant.email,
        startDate: participant.startDate || operation.startDate,
        endDate: participant.endDate || operation.forecastEndDate || operation.startDate,
        visa: participant.visa || createEmptyVisa(),
        actionItem: {
          id: `exceptional-planned-${operation.id}-${participant.userId}-${index}`,
          kind: "exceptional-participant-planned" as const,
          category: this.labels.validation.categories.exceptionalPlanned,
          title: operation.title,
          userLabel: participant.displayName || participant.email,
          startDate: participant.startDate || operation.startDate,
          endDate: participant.endDate || operation.forecastEndDate || operation.startDate,
          visa: participant.visa || createEmptyVisa(),
          payload: operation,
          index,
        },
      })),
      ...(operation.actualUsers || []).map((participant, index) => ({
        id: `exceptional-actual-${operation.id}-${participant.userId}-${index}`,
        role: this.labels.validation.roles.realStakeholder,
        userLabel: participant.displayName || participant.email,
        startDate: participant.startDate || operation.actualStartDate || operation.startDate,
        endDate: participant.endDate || operation.actualEndDate || operation.forecastEndDate || operation.startDate,
        visa: participant.visa || createEmptyVisa(),
        actionItem: {
          id: `exceptional-actual-${operation.id}-${participant.userId}-${index}`,
          kind: "exceptional-participant-actual" as const,
          category: this.labels.validation.categories.exceptionalActual,
          title: operation.title,
          userLabel: participant.displayName || participant.email,
          startDate: participant.startDate || operation.actualStartDate || operation.startDate,
          endDate: participant.endDate || operation.actualEndDate || operation.forecastEndDate || operation.startDate,
          visa: participant.visa || createEmptyVisa(),
          payload: operation,
          index,
        },
      })),
      ...(operation.interventions || []).map((intervention, index) => ({
        id: `exceptional-intervention-${operation.id}-${index}`,
        role: this.labels.validation.roles.interventionStakeholder,
        userLabel: intervention.userName || intervention.userEmail,
        startDate: intervention.startDate || intervention.date || "",
        endDate: intervention.endDate || "",
        visa: intervention.agentVisa || createEmptyVisa(),
        actionItem: {
          id: `exceptional-intervention-${operation.id}-${index}`,
          kind: "exceptional-intervention-agent" as const,
          category: this.labels.common.fields.intervention,
          title: operation.title,
          userLabel: intervention.userName || intervention.userEmail,
          startDate: intervention.startDate || intervention.date || "",
          endDate: intervention.endDate || "",
          visa: intervention.agentVisa || createEmptyVisa(),
          payload: operation,
          index,
        },
      })),
    ];
  }

  openItem(item: ValidationItem): void {
    this.selectedItem = item;
  }

  closeItem(): void {
    this.selectedItem = null;
  }

  signItem(item: ValidationItem): void {
    if (!this.user) {
      return;
    }

    const visa = this.buildVisa(item);
    let updatedPayload: ValidationItem["payload"];

    if (item.kind === "regular-period-agent" || item.kind === "regular-period-director") {
      const field = item.kind === "regular-period-agent" ? "agentVisa" : "directorVisa";
      const period = item.payload as RegularOnCallPeriod;
      const updatedPeriod = {
        ...period,
        [field]: visa,
      };

      this.store.dispatch(RegularActions.periodVisaUpdateRequested({
        field,
        periodId: period.id,
        visa,
      }));
      this.regularPeriods = this.regularPeriods.map((currentPeriod) =>
        currentPeriod.id === updatedPeriod.id ? updatedPeriod : currentPeriod,
      );
      updatedPayload = updatedPeriod;

      if (item.kind === "regular-period-agent" && item.isGlobalAction) {
        this.updateRegularInterventionVisas(updatedPeriod, visa);
      }
    } else if (item.kind === "regular-intervention-agent") {
      const intervention = item.payload as RegularIntervention;
      const updatedIntervention = {
        ...intervention,
        agentVisa: visa,
      };

      this.store.dispatch(RegularActions.interventionVisaUpdateRequested({
        interventionId: intervention.id,
        periodId: intervention.periodId,
        visa,
      }));
      this.regularInterventions = this.regularInterventions.map((currentIntervention) =>
        currentIntervention.id === updatedIntervention.id ? updatedIntervention : currentIntervention,
      );
      updatedPayload = updatedIntervention;
    } else {
      updatedPayload = this.signExceptionalItem(item, visa);
    }

    this.selectedItem =
      this.selectedItem && this.selectedItem.id !== item.id
        ? {
            ...this.selectedItem,
            payload: updatedPayload,
          }
        : {
            ...item,
            visa,
            payload: updatedPayload,
          };
    this.validationMessage = this.labels.validation.messages.saved;
  }

  formatDateTime(value: string): string {
    if (!value) {
      return "-";
    }

    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  }

  deleteVisa(item: ValidationItem): void {
    if (!this.canDeleteVisa(item)) {
      return;
    }

    const emptyVisa = createEmptyVisa();
    let updatedPayload: ValidationItem["payload"];

    if (item.kind === "regular-period-agent" || item.kind === "regular-period-director") {
      const field = item.kind === "regular-period-agent" ? "agentVisa" : "directorVisa";
      const period = item.payload as RegularOnCallPeriod;
      const updatedPeriod = {
        ...period,
        [field]: emptyVisa,
      };

      this.store.dispatch(RegularActions.periodVisaUpdateRequested({
        field,
        periodId: period.id,
        visa: emptyVisa,
      }));
      this.regularPeriods = this.regularPeriods.map((currentPeriod) =>
        currentPeriod.id === updatedPeriod.id ? updatedPeriod : currentPeriod,
      );
      updatedPayload = updatedPeriod;

      if (item.kind === "regular-period-agent" && item.isGlobalAction) {
        this.updateRegularInterventionVisas(updatedPeriod, emptyVisa);
      }
    } else if (item.kind === "regular-intervention-agent") {
      const intervention = item.payload as RegularIntervention;
      const updatedIntervention = {
        ...intervention,
        agentVisa: emptyVisa,
      };

      this.store.dispatch(RegularActions.interventionVisaUpdateRequested({
        interventionId: intervention.id,
        periodId: intervention.periodId,
        visa: emptyVisa,
      }));
      this.regularInterventions = this.regularInterventions.map((currentIntervention) =>
        currentIntervention.id === updatedIntervention.id ? updatedIntervention : currentIntervention,
      );
      updatedPayload = updatedIntervention;
    } else {
      updatedPayload = this.signExceptionalItem(item, emptyVisa);
    }

    this.selectedItem =
      this.selectedItem && this.selectedItem.id !== item.id
        ? {
            ...this.selectedItem,
            payload: updatedPayload,
          }
        : {
            ...item,
            visa: emptyVisa,
            payload: updatedPayload,
          };
    this.validationMessage = this.labels.validation.messages.deleted;
  }

  canDeleteVisa(item: ValidationItem): boolean {
    if (item.kind === "exceptional-operation-agent") {
      return this.exceptionalItemVisas(item).some((visa) => this.canActOnVisa(item, visa));
    }

    return this.canActOnVisa(item, item.visa);
  }

  userLabel(user: AppUser): string {
    return user.displayName ? `${user.displayName} (${user.email})` : user.email;
  }

  private refreshProfile(): void {
    if (!this.user) {
      this.profile = null;
      return;
    }

    this.profile = this.users.find((item) => item.id === this.user?.uid || item.uid === this.user?.uid) || null;

    if (!this.selectedUserId) {
      this.selectedUserId = this.user.uid;
    }
  }

  private operationGlobalItem(operation: ExceptionalOperation, kind: "exceptional-operation-initiator" | "exceptional-operation-director"): ValidationItem {
    const isDirector = kind === "exceptional-operation-director";
    const visa = isDirector
      ? operation.visas?.directorGlobal || operation.visas?.actualDirector || createEmptyVisa()
      : operation.visas?.initiatorGlobal || operation.visas?.actualInitiator || createEmptyVisa();

    return {
      id: `${kind}-${operation.id}`,
      kind,
      category: isDirector ? this.labels.validation.categories.exceptionalDirectorVisa : this.labels.validation.categories.exceptionalInitiatorVisa,
      title: operation.title,
      userLabel: isDirector ? this.labels.validation.roles.director : operation.initiatorName,
      startDate: operation.startDate,
      endDate: operation.actualEndDate || operation.forecastEndDate || operation.startDate,
      visa,
      payload: operation,
    };
  }

  private exceptionalOperationAgentItem(operation: ExceptionalOperation, selectedId: string, selectedEmail: string): ValidationItem | null {
    const participants = [
      ...(operation.plannedUsers || []),
      ...(operation.actualUsers || []),
    ].filter((participant) => this.matchesUser(participant.userId, participant.email, selectedId, selectedEmail));

    if (!participants.length) {
      return null;
    }

    const startDates = participants
      .map((participant) => participant.startDate || operation.actualStartDate || operation.startDate)
      .filter(Boolean)
      .sort((first, second) => first.localeCompare(second));
    const endDates = participants
      .map((participant) => participant.endDate || operation.actualEndDate || operation.forecastEndDate || operation.startDate)
      .filter(Boolean)
      .sort((first, second) => first.localeCompare(second));
    const visas = participants.map((participant) => participant.visa || createEmptyVisa());
    const isSigned = visas.length > 0 && visas.every((visa) => visa.signed);
    const firstParticipant = participants[0];
    const firstSignedVisa = visas.find((visa) => visa.signed);

    return {
      id: `exceptional-operation-agent-${operation.id}-${selectedId || selectedEmail}`,
      kind: "exceptional-operation-agent",
      category: this.labels.validation.categories.exceptionalOperation,
      title: operation.title,
      userLabel: firstParticipant.displayName || firstParticipant.email,
      startDate: startDates[0] || operation.startDate,
      endDate: endDates.at(-1) || operation.actualEndDate || operation.forecastEndDate || operation.startDate,
      visa: isSigned ? firstSignedVisa || visas[0] : createEmptyVisa(),
      payload: operation,
      isGlobalAction: true,
      userEmail: firstParticipant.email || selectedEmail,
      userId: firstParticipant.userId || selectedId,
    };
  }

  private isRegularPeriodReadyForDirector(period: RegularOnCallPeriod): boolean {
    const interventions = this.regularInterventions.filter((intervention) => intervention.periodId === period.id);

    return this.isVisaSigned(period.agentVisa) && interventions.every((intervention) => this.isVisaSigned(intervention.agentVisa));
  }

  private isExceptionalOperationReadyForDirector(operation: ExceptionalOperation): boolean {
    const initiatorVisa = operation.visas?.initiatorGlobal || operation.visas?.actualInitiator;
    const participantVisas = [
      ...(operation.plannedUsers || []).map((participant) => participant.visa),
      ...(operation.actualUsers || []).map((participant) => participant.visa),
      ...(operation.interventions || []).map((intervention) => intervention.agentVisa),
    ];

    return this.isVisaSigned(initiatorVisa) && participantVisas.every((visa) => this.isVisaSigned(visa));
  }

  private isVisaSigned(visa: SignatureVisa | undefined): boolean {
    return Boolean(visa?.signed);
  }

  private signExceptionalItem(item: ValidationItem, visa: SignatureVisa): ExceptionalOperation {
    const operation = item.payload as ExceptionalOperation;
    const payload: Partial<ExceptionalOperation> = {};

    if (item.kind === "exceptional-operation-agent") {
      const plannedUsers = (operation.plannedUsers || []).map((participant) =>
        this.matchesUser(participant.userId, participant.email, item.userId || "", item.userEmail || "") ? { ...participant, visa } : participant,
      );
      const actualUsers = (operation.actualUsers || []).map((participant) =>
        this.matchesUser(participant.userId, participant.email, item.userId || "", item.userEmail || "") ? { ...participant, visa } : participant,
      );
      payload.plannedUsers = plannedUsers;
      payload.actualUsers = actualUsers;
    } else if (item.kind === "exceptional-participant-planned" && typeof item.index === "number") {
      const plannedUsers = [...(operation.plannedUsers || [])];
      plannedUsers[item.index] = { ...plannedUsers[item.index], visa };
      payload.plannedUsers = plannedUsers;
    } else if (item.kind === "exceptional-participant-actual" && typeof item.index === "number") {
      const actualUsers = [...(operation.actualUsers || [])];
      actualUsers[item.index] = { ...actualUsers[item.index], visa };
      payload.actualUsers = actualUsers;
    } else if (item.kind === "exceptional-intervention-agent" && typeof item.index === "number") {
      const interventions = [...(operation.interventions || [])];
      interventions[item.index] = { ...interventions[item.index], agentVisa: visa };
      payload.interventions = interventions;
    } else if (item.kind === "exceptional-operation-initiator") {
      payload.visas = {
        ...operation.visas,
        initiatorGlobal: visa,
        actualInitiator: visa,
      };
    } else if (item.kind === "exceptional-operation-director") {
      payload.visas = {
        ...operation.visas,
        directorGlobal: visa,
        actualDirector: visa,
      };
    }

    if (item.kind === "exceptional-operation-agent" && item.isGlobalAction) {
      this.applyExceptionalInterventionVisa(item, operation, payload, visa);
    }

    this.store.dispatch(ExceptionalActions.operationPatchRequested({
      operationId: operation.id,
      payload,
    }));
    const updatedOperation = {
      ...operation,
      ...payload,
    };
    this.exceptionalOperations = this.exceptionalOperations.map((currentOperation) =>
      currentOperation.id === updatedOperation.id ? updatedOperation : currentOperation,
    );

    return updatedOperation;
  }

  private updateRegularInterventionVisas(period: RegularOnCallPeriod, visa: SignatureVisa): void {
    const interventions = this.regularInterventions.filter(
      (intervention) =>
        intervention.periodId === period.id &&
        this.matchesUser(intervention.userId, intervention.userEmail, period.userId, period.userEmail),
    );

    this.store.dispatch(RegularActions.interventionsVisaBatchUpdateRequested({
      interventions: interventions.map((intervention) => ({ id: intervention.id, periodId: intervention.periodId })),
      visa,
    }));
    this.regularInterventions = this.regularInterventions.map((intervention) =>
      interventions.some((updatedIntervention) => updatedIntervention.id === intervention.id)
        ? { ...intervention, agentVisa: visa }
        : intervention,
    );
  }

  private applyExceptionalInterventionVisa(
    item: ValidationItem,
    operation: ExceptionalOperation,
    payload: Partial<ExceptionalOperation>,
    visa: SignatureVisa,
  ): void {
    const targetUser = this.itemUserReference(item, operation);

    if (!targetUser.userId && !targetUser.email) {
      return;
    }

    const interventions = payload.interventions || [...(operation.interventions || [])];
    payload.interventions = interventions.map((intervention) => {
      if (!this.matchesUser(intervention.userId, intervention.userEmail, targetUser.userId, targetUser.email)) {
        return intervention;
      }

      return {
        ...intervention,
        agentVisa: visa,
      };
    });
  }

  private itemUserReference(item: ValidationItem, operation: ExceptionalOperation): { userId: string; email: string } {
    if (item.kind === "exceptional-operation-agent") {
      return { userId: item.userId || "", email: item.userEmail || "" };
    }

    if (item.kind === "exceptional-participant-planned" && typeof item.index === "number") {
      const participant = operation.plannedUsers?.[item.index];
      return { userId: participant?.userId || "", email: participant?.email || "" };
    }

    if (item.kind === "exceptional-participant-actual" && typeof item.index === "number") {
      const participant = operation.actualUsers?.[item.index];
      return { userId: participant?.userId || "", email: participant?.email || "" };
    }

    if (item.kind === "exceptional-operation-initiator") {
      return { userId: operation.initiatorUid || "", email: this.user?.email || "" };
    }

    if (item.kind === "exceptional-operation-director") {
      return { userId: this.user?.uid || "", email: this.user?.email || "" };
    }

    if (item.kind === "exceptional-intervention-agent" && typeof item.index === "number") {
      const intervention = operation.interventions?.[item.index];
      const email = intervention?.userEmail || "";
      return { userId: intervention?.userId || "", email };
    }

    return { userId: "", email: "" };
  }

  private buildVisa(item: ValidationItem): SignatureVisa {
    const signer = this.visaSignerForItem(item);
    let mode = signer.profile?.signatureMode || "name";

    let signatureValue: string;

    switch (mode) {
      case "image":
        signatureValue = signer.profile?.signatureImage || "";
        break;

      case "draw":
        signatureValue = signer.profile?.signatureDrawing || "";
        break;

      default:
        signatureValue = signer.name;
        break;
    }

    if ((mode === "image" || mode === "draw") && !this.isImageSignatureValue(signatureValue)) {
      mode = "name";
      signatureValue = signer.name;
    }
   
    return {
      signed: true,
      signedAt: new Date().toISOString(),
      signedByName: signer.name,
      signedByUid: signer.uid,
      signatureMode: mode,
      signatureValue,
    };
  }

  private isImageSignatureValue(value: string): boolean {
    return /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,/i.test(value);
  }

  private visaSignerForItem(item: ValidationItem): { uid: string; name: string; email: string; profile: AppUser | null } {
    const reference = this.visaSignerReference(item);
    const profile = this.findUser(reference.userId, reference.email);
    const fallbackName = reference.name || profile?.signatureName || profile?.displayName || profile?.email || this.user?.displayName || this.user?.email || "";
    const fallbackEmail = reference.email || profile?.email || this.user?.email || "";

    return {
      uid: reference.userId || profile?.uid || profile?.id || this.user?.uid || "",
      name: profile?.signatureName || profile?.displayName || fallbackName,
      email: fallbackEmail,
      profile: profile || null,
    };
  }

  private visaSignerReference(item: ValidationItem): { userId: string; email: string; name: string } {
    if (item.kind === "regular-period-agent") {
      const period = item.payload as RegularOnCallPeriod;
      return { userId: period.userId || "", email: period.userEmail || "", name: period.userName || period.userEmail || "" };
    }

    if (item.kind === "regular-intervention-agent") {
      const intervention = item.payload as RegularIntervention;
      return { userId: intervention.userId || "", email: intervention.userEmail || "", name: intervention.userName || intervention.userEmail || "" };
    }

    if (item.kind === "exceptional-operation-agent") {
      return { userId: item.userId || "", email: item.userEmail || "", name: item.userLabel || item.userEmail || "" };
    }

    if (item.kind === "exceptional-participant-planned" && typeof item.index === "number") {
      const operation = item.payload as ExceptionalOperation;
      const participant = operation.plannedUsers?.[item.index];
      return {
        userId: participant?.userId || "",
        email: participant?.email || "",
        name: participant?.displayName || participant?.email || "",
      };
    }

    if (item.kind === "exceptional-participant-actual" && typeof item.index === "number") {
      const operation = item.payload as ExceptionalOperation;
      const participant = operation.actualUsers?.[item.index];
      return {
        userId: participant?.userId || "",
        email: participant?.email || "",
        name: participant?.displayName || participant?.email || "",
      };
    }

    if (item.kind === "exceptional-operation-initiator") {
      const operation = item.payload as ExceptionalOperation;
      return { userId: operation.initiatorUid || "", email: "", name: operation.initiatorName || "" };
    }

    return {
      userId: this.user?.uid || "",
      email: this.user?.email || "",
      name: this.profile?.signatureName || this.user?.displayName || this.user?.email || "",
    };
  }

  private canActOnVisa(item: ValidationItem, visa: SignatureVisa): boolean {
    if (!visa.signed) {
      return false;
    }

    const signer = this.visaSignerForItem(item);

    return visa.signedByUid === signer.uid || visa.signedByUid === this.user?.uid;
  }

  private findUser(userId: string, email: string): AppUser | undefined {
    return this.users.find((item) => Boolean(userId && (item.id === userId || item.uid === userId)) || Boolean(email && item.email === email));
  }

  private matchesUser(userId: string | undefined, emailOrName: string | undefined, selectedId: string, selectedEmail: string): boolean {
    return Boolean(userId && userId === selectedId) || Boolean(emailOrName && selectedEmail && emailOrName === selectedEmail);
  }

  private isRegularPayload(payload: ValidationItem["payload"]): payload is RegularOnCallPeriod | RegularIntervention {
    return "teamId" in payload && !("type" in payload);
  }

  private exceptionalItemVisas(item: ValidationItem): SignatureVisa[] {
    if (item.kind !== "exceptional-operation-agent") {
      return [item.visa];
    }

    const operation = item.payload as ExceptionalOperation;

    return [
      ...(operation.plannedUsers || []),
      ...(operation.actualUsers || []),
    ]
      .filter((participant) => this.matchesUser(participant.userId, participant.email, item.userId || "", item.userEmail || ""))
      .map((participant) => participant.visa || createEmptyVisa());
  }

}
