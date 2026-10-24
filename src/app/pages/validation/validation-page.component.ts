import { hasDirectorRights } from "../../shared/user-role-permissions";
import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, OnDestroy, SimpleChanges, effect, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { MessageModule } from "primeng/message";
import { SelectModule } from "primeng/select";
import { TableModule } from "primeng/table";
import { TagModule } from "primeng/tag";
import { Store } from "@ngrx/store";
import { APP_LABELS } from "../../i18n/labels";
import { SignatureVisa, createEmptyVisa } from "../../shared/visa.models";
import { clearExceptionalDirectorVisas, exceptionalReadyForDirector, exceptionalReadyForRh, regularReadyForDirector, regularReadyForRh } from "../../shared/visa-workflow";
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
  selectRegularTeams,
} from "../../state/regular/regular.selectors";
import { SettingsActions } from "../../state/settings/settings.actions";
import { selectSettingsMessage, selectSettingsUsers } from "../../state/settings/settings.selectors";
import { StoreAuthUser } from "../../store/app-store";
import { ExceptionalOperation } from "../exceptionnel/exceptional.models";
import { RegularIntervention, RegularOnCallPeriod } from "../regular/regular.models";
import { ValidationConsultationModalComponent } from "./validation-consultation-modal.component";
import { AppUser, ValidationItem, ValidationSection, ValidationSectionId, VisaProgressItem } from "./validation.models";

/**
 * Orchestration des visas.
 *
 * La page agrège les astreintes régulières, interventions et opérations
 * exceptionnelles pour produire trois files de validation : intervenants,
 * initiateurs et directeurs. Les droits ne sont pas purement UI : ils traduisent
 * les contraintes métier de signature et déterminent les écritures envoyées au
 * store NgRx.
 */
@Component({
  selector: "app-validation-page",
  standalone: true,
  imports: [ButtonModule, CardModule, CommonModule, FormsModule, MessageModule, SelectModule, TableModule, TagModule, ValidationConsultationModalComponent],
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
  readonly canSignVisaForModal = (item: ValidationItem): boolean => this.canSignVisa(item);
  // PrimeNG must reuse rows: getters rebuild their objects during pointer events.
  readonly trackValidationItem = (_index: number, item: ValidationItem): string => item.id;

  private readonly store = inject(Store);
  private readonly exceptionalError = this.store.selectSignal(selectExceptionalError);
  private readonly exceptionalOperationsSignal = this.store.selectSignal(selectExceptionalOperations);
  private readonly regularError = this.store.selectSignal(selectRegularError);
  private readonly regularInterventionsSignal = this.store.selectSignal(selectRegularInterventions);
  private readonly regularPeriodsSignal = this.store.selectSignal(selectRegularPeriods);
  private readonly regularTeams = this.store.selectSignal(selectRegularTeams);
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
      // Team names can arrive after periods or change while the consultation is open.
      this.regularTeams();
      this.refreshSelectedItem();
    });

    effect(() => {
      this.regularInterventions = this.regularInterventionsSignal();
      this.refreshSelectedItem();
    });

    effect(() => {
      this.exceptionalOperations = this.exceptionalOperationsSignal();
      this.refreshSelectedItem();
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
    return this.isAdmin || hasDirectorRights(this.profile?.role);
  }

  get selectedUser(): AppUser | undefined {
    return this.users.find((item) => item.id === this.selectedUserId || item.uid === this.selectedUserId);
  }

  /** Identify regular on-call periods by their team; the agent has a dedicated column. */
  private regularPeriodTitle(period: RegularOnCallPeriod): string {
    return this.regularTeams().find((team) => team.id === period.teamId)?.name
      || this.labels.common.users.unspecified;
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
          title: this.regularPeriodTitle(period),
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
          title: this.regularPeriodTitle(period),
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
            title: this.regularPeriodTitle(period),
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
            title: this.regularPeriodTitle(period),
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
            title: this.regularPeriodTitle(period),
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
          category: this.operationCategories(operation).planned,
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
          category: this.operationCategories(operation).actual,
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

  /** Keep the consultation attached to its own aggregate, not the last signed child. */
  private refreshSelectedItem(): void {
    const selected = this.selectedItem;
    if (!selected) return;
    let payload: ValidationItem["payload"] | undefined;
    if (selected.kind === "regular-intervention-agent") {
      payload = this.regularInterventions.find(item => item.id === selected.payload.id);
    } else if (selected.kind.startsWith("regular-period-")) {
      payload = this.regularPeriods.find(item => item.id === selected.payload.id);
    } else {
      payload = this.exceptionalOperations.find(item => item.id === selected.payload.id);
    }
    if (!payload) return;
    this.selectedItem = { ...selected, payload };
    const refreshed = this.validationItems.find(item => item.id === selected.id)
      || this.selectedItemVisaProgress.find(item => item.actionItem?.id === selected.id)?.actionItem;
    if (refreshed) this.selectedItem = refreshed;
  }

  /**
   * Signe l'élément sélectionné selon son type métier.
   *
   * Cas particulier important : une signature globale d'agent sur une opération
   * ou une astreinte doit aussi viser les interventions associées de cet agent,
   * pour éviter une validation partielle invisible côté RH.
   */
  signItem(item: ValidationItem): void {
    if (!this.user || !this.canSignVisa(item)) {
      return;
    }

    const visa = this.buildVisa(item);

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
    } else {
      this.signExceptionalItem(item, visa);
    }

    this.refreshSelectedItem();
    this.validationMessage = this.labels.validation.messages.saved;
  }

  formatDateTime(value: string): string {
    if (!value) {
      return "-";
    }

    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  }

  /**
   * Supprime un visa uniquement si l'utilisateur courant est autorisé à agir.
   *
   * Pour les administrateurs, l'action peut viser le visa de l'utilisateur
   * représenté par la ligne ; pour les autres profils, seule leur propre
   * signature est modifiable.
   */
  deleteVisa(item: ValidationItem): void {
    if (!this.canDeleteVisa(item)) {
      return;
    }

    const emptyVisa = createEmptyVisa();

    if (item.kind === "regular-period-agent" || item.kind === "regular-period-director") {
      const field = item.kind === "regular-period-agent" ? "agentVisa" : "directorVisa";
      const period = item.payload as RegularOnCallPeriod;
      const updatedPeriod = {
        ...period,
        [field]: emptyVisa,
        directorVisa: emptyVisa,
      };

      this.store.dispatch(RegularActions.periodVisaUpdateRequested({
        field,
        periodId: period.id,
        visa: emptyVisa,
      }));
      this.regularPeriods = this.regularPeriods.map((currentPeriod) =>
        currentPeriod.id === updatedPeriod.id ? updatedPeriod : currentPeriod,
      );

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
      this.regularPeriods = this.regularPeriods.map(period => period.id === intervention.periodId ? { ...period, directorVisa: createEmptyVisa() } : period);
    } else {
      this.signExceptionalItem(item, emptyVisa);
    }

    this.refreshSelectedItem();
    this.validationMessage = this.labels.validation.messages.deleted;
  }

  /** Expose au template la règle d'autorisation de suppression sans dupliquer la logique métier. */
  canDeleteVisa(item: ValidationItem): boolean {
    if (this.isItemSentToRh(item)) return false;
    if (item.kind === "exceptional-operation-agent") {
      return this.exceptionalItemVisas(item).some((visa) => this.canActOnVisa(item, visa));
    }

    return this.canActOnVisa(item, item.visa);
  }

  /** The modal and direct actions enforce the same final-approval prerequisites. */
  canSignVisa(item: ValidationItem): boolean {
    if (!this.canApplyVisa(item) || item.visa.signed || this.isItemSentToRh(item)) return false;
    if (item.kind === "regular-period-director") {
      const period = this.regularPeriods.find(period => period.id === item.payload.id);
      return Boolean(period && this.isRegularPeriodReadyForDirector(period));
    }
    if (item.kind === "exceptional-operation-director") {
      const operation = this.exceptionalOperations.find(operation => operation.id === item.payload.id);
      return Boolean(operation && this.isExceptionalOperationReadyForDirector(operation));
    }
    return true;
  }

  /**
   * Les droits de visa sont indépendants du filtrage : une ligne visible dans
   * le détail ne donne pas le droit de signer pour son titulaire. Les identités
   * SQL du profil et de l'initiateur déterminent les délégations autorisées.
   */
  private canApplyVisa(item: ValidationItem): boolean {
    if (!this.user || !this.profile) return false;
    const role = this.profile.role;
    if (role === 0 || hasDirectorRights(role)) return true;
    if (role !== 1 && role !== 2) return false;
    // Une ligne directeur représente une approbation, sans titulaire agent.
    if (item.kind === "regular-period-director" || item.kind === "exceptional-operation-director") return false;
    const reference = this.visaSignerReference(item);
    if (reference.userId === this.profile.id || Boolean(this.profile.uid && reference.userId === this.profile.uid)) return true;
    if (role !== 2 || this.isRegularPayload(item.payload)) return false;
    const operation = item.payload as ExceptionalOperation;
    const isParticipantLine = item.kind === "exceptional-operation-agent"
      || item.kind === "exceptional-participant-planned" || item.kind === "exceptional-participant-actual"
      || item.kind === "exceptional-intervention-agent";
    return isParticipantLine && operation.initiatorUid === this.profile.id;
  }
  /** RH actions belong to whole-operation director rows and retain director/admin permissions. */
  canManageRhSend(item: ValidationItem): boolean {
    return this.canViewDirectorSection
      && (item.kind === "regular-period-director" || item.kind === "exceptional-operation-director");
  }

  /** Read live store projections so a row captured before a visa change cannot bypass prerequisites. */
  canSendToRh(item: ValidationItem): boolean {
    if (!this.canManageRhSend(item) || this.isItemSentToRh(item)) return false;
    if (item.kind === "regular-period-director") {
      const period = this.regularPeriods.find(period => period.id === item.payload.id);
      return Boolean(period && regularReadyForRh(period,
        this.regularInterventions.filter(intervention => intervention.periodId === period.id)));
    }
    const operation = this.exceptionalOperations.find(operation => operation.id === item.payload.id);
    return Boolean(operation && exceptionalReadyForRh(operation));
  }

  /** Reuse the existing NgRx persistence path; cancelling unlocks the operation for corrections. */
  updateRhSend(item: ValidationItem, sent: boolean): void {
    if (!this.canManageRhSend(item)) return;
    if (sent ? !this.canSendToRh(item) : !this.isItemSentToRh(item)) return;
    if (item.kind === "regular-period-director") {
      this.store.dispatch(RegularActions.periodRhSentUpdateRequested({ periodId: item.payload.id, sent }));
    } else {
      this.store.dispatch(ExceptionalActions.operationRhSentUpdateRequested({ operationId: item.payload.id, sent }));
    }
  }

  isItemSentToRh(item: ValidationItem): boolean {
    if (item.kind === "regular-intervention-agent") {
      const intervention = item.payload as RegularIntervention;
      return Boolean(this.regularPeriods.find(period => period.id === intervention.periodId)?.sentToRhAt);
    }
    const source = this.isRegularPayload(item.payload)
      ? this.regularPeriods.find(period => period.id === item.payload.id)
      : this.exceptionalOperations.find(operation => operation.id === item.payload.id);
    return Boolean(source?.sentToRhAt);
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

  /**
   * Crée la ligne de visa global d'une opération exceptionnelle.
   *
   * Les visas historiques prévisionnel/réel sont conservés comme fallback pour
   * rester compatible avec les opérations créées avant l'introduction du visa
   * global unifié.
   */
  private operationGlobalItem(operation: ExceptionalOperation, kind: "exceptional-operation-initiator" | "exceptional-operation-director"): ValidationItem {
    const isDirector = kind === "exceptional-operation-director";
    const visa = isDirector
      ? operation.visas?.directorGlobal || operation.visas?.actualDirector || createEmptyVisa()
      : operation.visas?.initiatorGlobal || operation.visas?.actualInitiator || createEmptyVisa();

    return {
      id: `${kind}-${operation.id}`,
      kind,
      category: isDirector ? this.operationCategories(operation).directorVisa : this.operationCategories(operation).initiatorVisa,
      title: operation.title,
      userLabel: isDirector ? this.labels.validation.roles.director : operation.initiatorName,
      startDate: operation.startDate,
      endDate: operation.actualEndDate || operation.forecastEndDate || operation.startDate,
      visa,
      payload: operation,
    };
  }

  /** Keep the business family explicit in both approval queues and consultation details. */
  private operationCategories(operation: ExceptionalOperation) {
    return operation.type === "astreinte"
      ? this.labels.validation.categories.exceptionalOnCall
      : this.labels.validation.categories.exceptionalWork;
  }

  /**
   * Fusionne les engagements agent en une ligne par opération et utilisateur ;
   * la consultation conserve chaque période prévisionnelle et réelle.
   */
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
      category: this.operationCategories(operation).operation,
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

  /**
   * Le directeur ne peut viser une astreinte régulière qu'après validation agent.
   * Les interventions rattachées doivent être signées également car elles
   * impactent le même envoi RH.
   */
  private isRegularPeriodReadyForDirector(period: RegularOnCallPeriod): boolean {
    const interventions = this.regularInterventions.filter((intervention) => intervention.periodId === period.id);

    return regularReadyForDirector(period, interventions);
  }

  /**
   * Le visa directeur d'une opération exceptionnelle est volontairement en bout
   * de chaîne : initiateur, agents prévisionnels/réels et intervenants doivent
   * avoir signé avant qu'elle apparaisse dans la file directeur.
   */
  private isExceptionalOperationReadyForDirector(operation: ExceptionalOperation): boolean {
    return exceptionalReadyForDirector(operation);
  }

  /**
   * Applique un visa à la bonne zone d'une opération exceptionnelle.
   *
   * Les signatures peuvent être globales, par période ou par intervention. Cette
   * méthode garde ces écritures séparées afin qu'un visa de ligne ne propage pas
   * accidentellement toutes les périodes d'un même utilisateur.
   */
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

    if (!this.canApplyVisa(item) || !visa.signed) {
      payload.visas = clearExceptionalDirectorVisas(payload.visas ?? operation.visas);
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

  /**
   * Propage un visa global d'astreinte régulière aux interventions de l'agent.
   *
   * Cette propagation est limitée à l'utilisateur de l'astreinte et à la période
   * concernée ; elle évite de viser des interventions d'une autre équipe ou d'une
   * autre période.
   */
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

  /**
   * Construit le visa sauvegardé en base.
   *
   * Les nouveaux visas utilisent uniquement le nom, même si un ancien profil
   * conserve une préférence graphique. Les visas historiques restent inchangés.
   */
  private buildVisa(item: ValidationItem): SignatureVisa {
    const signer = this.visaSignerForItem(item);

    return {
      signed: true,
      signedAt: new Date().toISOString(),
      signedByName: signer.name,
      signedByUid: signer.uid,
      signatureMode: "name",
      signatureValue: signer.name,
    };
  }

  /**
   * Détermine le signataire métier du visa.
   *
   * Un administrateur peut signer à la place d'un autre utilisateur : le visa
   * enregistré doit alors porter l'identité de l'utilisateur représenté par la
   * ligne, pas celle de l'administrateur qui a cliqué.
   */
  private visaSignerForItem(item: ValidationItem): { uid: string; name: string; email: string; profile: AppUser | null } {
    if (!this.isAdmin) {
      return {
        uid: this.user?.uid || "",
        name: this.profile?.signatureName || this.profile?.displayName || this.user?.displayName || this.user?.email || "",
        email: this.user?.email || "",
        profile: this.profile,
      };
    }
    const reference = this.visaSignerReference(item);
    const profile = this.findUser(reference.userId, reference.email);
    const fallbackName = reference.name || profile?.signatureName || profile?.displayName || profile?.email || this.user?.displayName || this.user?.email || "";
    const fallbackEmail = reference.email || profile?.email || this.user?.email || "";

    return {
      uid: profile?.uid || reference.userId || profile?.id || this.user?.uid || "",
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

  /**
   * Vérifie qu'une signature existante peut être supprimée ou remplacée.
   *
   * Les administrateurs peuvent retirer tout visa. Les autres profils doivent
   * être autorisés sur la ligne et être les signataires du visa enregistré.
   */
  private canActOnVisa(item: ValidationItem, visa: SignatureVisa): boolean {
    if (!this.canApplyVisa(item) || !visa.signed) {
      return false;
    }

    if (this.isAdmin) return true;
    return visa.signedByUid === this.user?.uid;
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
