import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { selectExceptionalError, selectExceptionalOperations } from "../../state/exceptional/exceptional.selectors";
import { selectRegularError, selectRegularInterventions, selectRegularPeriods, selectRegularTeams } from "../../state/regular/regular.selectors";
import { selectSettingsDirections, selectSettingsMessage, selectSettingsUsers } from "../../state/settings/settings.selectors";
import { createEmptyVisa } from "../../shared/visa.models";
import { ExceptionalOperation, RegularIntervention, RegularOnCallPeriod } from "../../types";
import { ValidationPageComponent } from "./validation-page.component";

const period: RegularOnCallPeriod = {
  id: "11", teamId: "2", userId: "7", userName: "Agent", userEmail: "agent@example.fr",
  startDate: "2026-10-10T18:00", endDate: "2026-10-11T08:00", agentVisa: createEmptyVisa(),
};
const intervention: RegularIntervention = {
  ...period, id: "12", periodId: period.id, comment: "Intervention",
};

function createPage() {
  const fixture = TestBed.createComponent(ValidationPageComponent);
  fixture.componentRef.setInput("user", { uid: "auth-id", email: period.userEmail, displayName: "Agent" });
  fixture.detectChanges();
  return fixture;
}


describe("Validation consultation", () => {
  it("shows regular and exceptional intervention tickets in the validation detail", () => {
    const fixture = createPage();
    const component = fixture.componentInstance;
    component.regularInterventions = [{ ...intervention, ticket: "REG-123" }];
    component.openItem(component.validationItems[0]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".progress-table").textContent).toContain("REG-123");
    const operation: ExceptionalOperation = {
      id: "astreinte:91", type: "astreinte", title: "Operation", initiatorUid: "7", initiatorName: "Agent",
      operationManagerUid: "7", operationManagerName: "Agent", startDate: period.startDate,
      forecastEndDate: period.endDate, actualStartDate: period.startDate, actualEndDate: period.endDate,
      plannedUsers: [], actualUsers: [],
      interventions: [{ ...intervention, wasOnSite: false, label: "", ticket: "EXC-456" }],
      visas: { initiatorGlobal: createEmptyVisa(), directorGlobal: createEmptyVisa() },
    };
    component.exceptionalOperations = [operation];
    component.openItem(component.validationItems.find(item => item.payload.id === operation.id)!);
    fixture.detectChanges();
    const table = fixture.nativeElement.querySelector(".progress-table") as HTMLElement;
    expect(table.textContent).toContain("EXC-456");
    expect(table.querySelectorAll("th")).toHaveLength(7);
    expect(component.selectedItemVisaProgress.find(row => row.ticket === "EXC-456")?.actionItem?.kind).toBe("exceptional-intervention-agent");
  });

  it.each(["regular", "astreinte", "travaux"] as const)("keeps a sent %s in director validation until treatment", family => {
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectSettingsUsers, [{ id: "7", uid: "auth-id", displayName: "Agent", email: period.userEmail, role: 3 }]);
    const fixture = createPage();
    const component = fixture.componentInstance;
    const sentToRhAt = "2026-10-24T10:00";
    const operation: ExceptionalOperation = {
      id: `${family}:91`, type: family === "travaux" ? "travaux" : "astreinte", title: "Sent operation",
      initiatorUid: "7", initiatorName: "Agent", operationManagerUid: "7", operationManagerName: "Agent",
      startDate: period.startDate, forecastEndDate: period.endDate, actualStartDate: "", actualEndDate: "",
      plannedUsers: [], actualUsers: [], interventions: [], sentToRhAt,
      visas: { initiatorGlobal: createEmptyVisa(), directorGlobal: createEmptyVisa() },
    };
    if (family === "regular") store.overrideSelector(selectRegularPeriods, [{ ...period, sentToRhAt }]);
    else {
      store.overrideSelector(selectRegularPeriods, []);
      store.overrideSelector(selectExceptionalOperations, [operation]);
    }
    store.refreshState();
    fixture.detectChanges();
    expect(component.directorVisaItems).toHaveLength(1);
    expect(component.intervenantVisaItems).toEqual([]);
    expect(component.initiatorVisaItems).toEqual([]);
    const item = component.directorVisaItems[0];
    component.activeSectionId = "director";
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(component.labels.common.actions.cancelRhSend);
    const dispatch = jest.spyOn(store, "dispatch").mockClear();
    component.updateRhSend(item, false);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ sent: false }));
    const treatedAt = "2026-10-24T11:00";
    if (family === "regular") store.overrideSelector(selectRegularPeriods, [{ ...period, sentToRhAt, treatedAt }]);
    else store.overrideSelector(selectExceptionalOperations, [{ ...operation, treatedAt }]);
    store.refreshState();
    fixture.detectChanges();
    expect(component.directorVisaItems).toEqual([]);
    dispatch.mockClear();
    component.updateRhSend(item, false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("removes archived periods from validation and closes an open consultation", () => {
    const fixture = createPage();
    const component = fixture.componentInstance;
    component.openItem(component.validationItems[0]);
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectRegularPeriods, [
      { ...period, sentToRhAt: "2026-10-24T10:00" },
      { ...period, id: "99", treatedAt: "2026-10-24T11:00" },
    ]);
    store.refreshState();
    fixture.detectChanges();
    expect(component.validationItems).toEqual([]);
    expect(component.selectedItem).toBeNull();
  });
  it("defaults to the profile direction after asynchronous loading and preserves All on refresh", () => {
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectSettingsUsers, []);
    store.overrideSelector(selectSettingsDirections, []);
    const fixture = createPage();
    const component = fixture.componentInstance;
    store.overrideSelector(selectSettingsUsers, [{ id: "7", uid: "auth-id", displayName: "Agent", email: period.userEmail, role: 3, directionId: "2" }]);
    store.refreshState();
    fixture.detectChanges();
    expect(component.selectedDirectionId).toBe("");
    store.overrideSelector(selectSettingsDirections, [{ id: "2", name: "Services" }]);
    store.refreshState();
    fixture.detectChanges();
    expect(component.selectedDirectionId).toBe("2");
    component.selectedDirectionId = "";
    store.refreshState();
    fixture.detectChanges();
    expect(component.selectedDirectionId).toBe("");
  });

  it.each(["astreinte", "travaux"] as const)("opens initiator validation for a director's own %s", type => {
    const fixture = createPage();
    const component = fixture.componentInstance;
    component.profile = { ...component.profile!, role: 3 };
    const own: ExceptionalOperation = {
      id: `${type}:91`, type, title: "Own operation", initiatorUid: "7", initiatorName: "Agent",
      operationManagerUid: "7", operationManagerName: "Agent", startDate: period.startDate,
      forecastEndDate: period.endDate, actualStartDate: "", actualEndDate: "",
      plannedUsers: [], actualUsers: [], interventions: [],
      visas: { initiatorGlobal: createEmptyVisa(), directorGlobal: createEmptyVisa() },
    };
    component.exceptionalOperations = [{ ...own, id: `${type}:92`, initiatorUid: "9", initiatorName: "Other" }];
    expect(component.canViewInitiatorSection).toBe(false);
    component.exceptionalOperations.push(own);
    fixture.detectChanges();
    expect(component.validationSections.map(section => section.id)).toContain("initiator");
    expect(component.initiatorVisaItems.map(item => item.payload.id)).toEqual([own.id]);
    expect(component.canSignVisa(component.initiatorVisaItems[0])).toBe(true);
    const menu = Array.from(fixture.nativeElement.querySelectorAll(".validation-submenu-button")) as HTMLButtonElement[];
    const initiatorButton = menu.find(button => button.textContent?.includes(component.labels.validation.sections.initiator));
    expect(initiatorButton).toBeDefined();
    initiatorButton!.click();
    fixture.detectChanges();
    expect(component.activeValidationSection.id).toBe("initiator");
    expect(component.activeValidationSection.items).toHaveLength(1);
  });

  it.each([
    ["astreinte", "Astreinte exceptionnelle"],
    ["travaux", "Travail supplémentaire"],
  ] as const)("uses the %s family label in every approval category", (type, label) => {
    const fixture = createPage();
    const component = fixture.componentInstance;
    const visa = { ...createEmptyVisa(), signed: true };
    const participant = { userId: "7", displayName: "Agent", email: period.userEmail,
      startDate: period.startDate, endDate: period.endDate, visa };
    component.selectedUserId = "7";
    component.profile = { id: "7", email: period.userEmail, displayName: "Agent", role: 0 };
    component.exceptionalOperations = [{
      id: `${type}:11`, type, title: "Test", initiatorUid: "7", initiatorName: "Agent",
      operationManagerUid: "7", operationManagerName: "Agent", startDate: period.startDate,
      forecastEndDate: period.endDate, actualStartDate: period.startDate, actualEndDate: period.endDate,
      plannedUsers: [participant], actualUsers: [participant], interventions: [],
      visas: { initiatorGlobal: visa, directorGlobal: visa },
    }];
    const items = component.validationItems.filter(item => item.payload.id === `${type}:11`);
    expect(items.map(item => item.category)).toEqual(expect.arrayContaining([
      label, `${label} - visa initiateur`, `${label} - visa directeur`,
    ]));
    component.openItem(items.find(item => item.kind === "exceptional-operation-agent")!);
    const categories = component.selectedItemVisaProgress.map(item => item.actionItem?.category);
    expect(categories).toEqual(expect.arrayContaining([`${label} - prévisionnel`, `${label} - réel`,
      `${label} - visa initiateur`, `${label} - visa directeur`]));
    expect([...items.map(item => item.category), ...categories].join(" ")).not.toContain("Opération exceptionnelle");
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValidationPageComponent],
      providers: [provideNoopAnimations(), provideMockStore({ selectors: [
        { selector: selectRegularPeriods, value: [period] },
        { selector: selectRegularTeams, value: [{ id: "2", name: "Équipe technique", members: [] }] },
        { selector: selectRegularInterventions, value: [intervention] },
        { selector: selectExceptionalOperations, value: [] },
        { selector: selectRegularError, value: "" },
        { selector: selectExceptionalError, value: "" },
        { selector: selectSettingsMessage, value: null },
        { selector: selectSettingsDirections, value: [{ id: "1", name: "Technique" }, { id: "2", name: "Services" }] },
        { selector: selectSettingsUsers, value: [{ id: "7", uid: "auth-id", displayName: "Agent", email: period.userEmail, role: 1 }] },
      ] })],
    }).compileComponents();
  });


  it("affiche le nom de l’équipe comme titre et conserve la personne dans sa colonne", () => {
    const fixture = createPage();
    const item = fixture.componentInstance.validationItems[0];
    expect(item.title).toBe("Équipe technique");
    expect(item.userLabel).toBe("Agent");
    fixture.componentInstance.openItem(item);
    fixture.detectChanges();
    const cells = fixture.nativeElement.querySelectorAll(".validation-table tbody tr:first-child td") as NodeListOf<HTMLElement>;
    expect(cells[1].textContent).toContain("Équipe technique");
    expect(cells[2].textContent).toContain("Agent");
    expect(fixture.nativeElement.querySelector(".item-details h3").textContent).toContain("Équipe technique");
  });

  it("keeps the same consultation button through pointer change detection and opens the modal", () => {
    const fixture = createPage();
    const button = fixture.nativeElement.querySelector(".actions button") as HTMLButtonElement;
    expect(button).not.toBeNull();
    button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".actions button")).toBe(button);
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("dialog")).not.toBeNull();
    const progressButton = fixture.nativeElement.querySelector(".row-actions button");
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".row-actions button")).toBe(progressButton);
  });

  it("refreshes an open consultation from NgRx after saving a visa", () => {
    const fixture = createPage();
    fixture.componentInstance.openItem(fixture.componentInstance.validationItems[0]);
    const visa = { ...createEmptyVisa(), signed: true, signedByUid: "auth-id", signedByName: "Agent", signedAt: "2026-10-10T19:00:00Z" };
    const updated = { ...period, agentVisa: visa };
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectRegularPeriods, [updated]);
    store.refreshState();
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedItem?.payload).toBe(updated);
    expect(fixture.componentInstance.selectedItem?.visa).toEqual(visa);
    expect(fixture.componentInstance.canDeleteVisa(fixture.componentInstance.selectedItem!)).toBe(true);
  });

  it("keeps the parent period selected when signing one of its interventions", () => {
    const fixture = createPage();
    const component = fixture.componentInstance;
    component.openItem(component.validationItems[0]);
    const child = component.selectedItemVisaProgress.find(row => row.actionItem?.kind === "regular-intervention-agent")!.actionItem!;
    component.signItem(child);
    expect(component.selectedItem?.payload.id).toBe(period.id);
    expect(component.selectedItemVisaProgress).toHaveLength(3);
    expect(component.selectedItemVisaProgress[2].visa.signed).toBe(true);
  });

  it("disables premature director approval in the consultation and refuses direct invocation", () => {
    const fixture = createPage();
    const component = fixture.componentInstance;
    component.openItem(component.validationItems[0]);
    fixture.detectChanges();
    const director = component.selectedItemVisaProgress.find(row => row.actionItem?.kind === "regular-period-director")!.actionItem!;
    const button = fixture.nativeElement.querySelectorAll(".progress-table tbody tr")[1].querySelector("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch");
    dispatch.mockClear();
    component.signItem(director);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("revokes the displayed director immediately when an intervention visa is removed", () => {
    const fixture = createPage();
    const store = TestBed.inject(MockStore);
    const signed = { ...createEmptyVisa(), signed: true, signedByUid: "auth-id", signedByName: "Agent" };
    store.overrideSelector(selectRegularPeriods, [{ ...period, agentVisa: signed, directorVisa: signed }]);
    store.overrideSelector(selectRegularInterventions, [{ ...intervention, agentVisa: signed }]);
    store.refreshState();
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openItem(component.validationItems[0]);
    const child = component.selectedItemVisaProgress.find(row => row.actionItem?.kind === "regular-intervention-agent")!.actionItem!;
    component.deleteVisa(child);
    const director = component.selectedItemVisaProgress.find(row => row.actionItem?.kind === "regular-period-director")!;
    expect(director.visa.signed).toBe(false);
    expect(component.canSignVisa(director.actionItem!)).toBe(false);
  });

  it.each(["astreinte", "travaux"] as const)("refreshes the qualified %s operation in the open modal", type => {
    const fixture = createPage();
    const visa = createEmptyVisa();
    const operation: ExceptionalOperation = {
      id: `${type}:11`, type, title: "Operation", initiatorUid: "7", initiatorName: "Agent",
      operationManagerUid: "7", operationManagerName: "Agent", startDate: period.startDate,
      forecastEndDate: period.endDate, actualStartDate: period.startDate, actualEndDate: period.endDate,
      plannedUsers: [{ userId: "7", displayName: "Agent", email: period.userEmail, startDate: period.startDate, endDate: period.endDate, visa }],
      actualUsers: [], interventions: [],
      visas: { plannedInitiator: visa, plannedDirector: visa, actualInitiator: visa, actualDirector: visa },
    };
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectExceptionalOperations, [operation]);
    store.refreshState();
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openItem(component.validationItems.find(item => item.payload.id === operation.id && item.kind === "exceptional-operation-agent")!);
    const signed = { ...visa, signed: true, signedByUid: "auth-id", signedByName: "Agent" };
    const updated = { ...operation, plannedUsers: [{ ...operation.plannedUsers[0], visa: signed }] };
    store.overrideSelector(selectExceptionalOperations, [updated]);
    store.refreshState();
    fixture.detectChanges();
    expect(component.selectedItem?.payload).toBe(updated);
    expect(component.selectedItem?.visa.signed).toBe(true);
    expect(component.selectedItemVisaProgress.find(row => row.actionItem?.kind === "exceptional-participant-planned")?.visa).toEqual(signed);
  });

  it.each([0, 1, 2, 3, 4] as const)("contrôle les lignes régulières propres et étrangères pour le profil %s", role => {
    const fixture = createPage();
    const component = fixture.componentInstance;
    component.profile = { ...component.profile!, role };
    const own = component.validationItems.find(item => item.kind === 'regular-period-agent')!;
    const foreign = { ...own, payload: { ...period, userId: '8' } };
    expect(component.canSignVisa(own)).toBe(true);
    expect(component.canSignVisa(foreign)).toBe(role === 0 || role === 3 || role === 4);
    if (role === 1 || role === 2) {
      const dispatch = jest.spyOn(TestBed.inject(MockStore), 'dispatch').mockClear();
      component.signItem(foreign);
      expect(dispatch).not.toHaveBeenCalled();
    }
  });

  it.each(['astreinte', 'travaux'] as const)("applique la délégation par initiateur aux participants %s", type => {
    const fixture = createPage();
    const component = fixture.componentInstance;
    const visa = createEmptyVisa();
    const participant = { userId: '8', displayName: 'Autre agent', email: 'other@example.test',
      startDate: period.startDate, endDate: period.endDate, visa };
    const operation: ExceptionalOperation = {
      id: `${type}:11`, type, title: 'Test', initiatorUid: '7', initiatorName: 'Agent',
      operationManagerUid: '', operationManagerName: '', startDate: period.startDate,
      forecastEndDate: period.endDate, actualStartDate: period.startDate, actualEndDate: period.endDate,
      plannedUsers: [participant], actualUsers: [participant], interventions: [],
      visas: { plannedInitiator: visa, plannedDirector: visa, actualInitiator: visa, actualDirector: visa },
    };
    component.exceptionalOperations = [operation];
    component.selectedUserId = "8";
    component.profile = { ...component.profile!, role: 0 };
    component.openItem(component.validationItems.find(item => item.kind === 'exceptional-operation-agent')!);
    const planned = component.selectedItemVisaProgress.find(row => row.actionItem?.kind === 'exceptional-participant-planned')!.actionItem!;
    for (const role of [0, 1, 2, 3, 4] as const) {
      component.profile = { ...component.profile!, role };
      expect(component.canSignVisa(planned)).toBe(role !== 1);
      const foreign = { ...planned, payload: { ...operation, initiatorUid: '9' } };
      expect(component.canSignVisa(foreign)).toBe(role === 0 || role === 3 || role === 4);
    }
    component.profile = { ...component.profile!, role: 2 };
    const dispatch = jest.spyOn(TestBed.inject(MockStore), 'dispatch').mockClear();
    component.signItem(planned);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({
      plannedUsers: [expect.objectContaining({ visa: expect.objectContaining({ signedByUid: 'auth-id', signedByName: 'Agent' }) })],
    }) }));
  });

  it("réserve l'approbation directeur aux administrateurs et directeurs même lorsque les prérequis sont satisfaits", () => {
    const component = createPage().componentInstance;
    const signed = { ...createEmptyVisa(), signed: true };
    component.regularPeriods = [{ ...period, agentVisa: signed }];
    component.regularInterventions = [{ ...intervention, agentVisa: signed }];
    component.openItem(component.validationItems[0]);
    const director = component.selectedItemVisaProgress.find(row => row.actionItem?.kind === 'regular-period-director')!.actionItem!;
    for (const role of [0, 1, 2, 3, 4] as const) {
      component.profile = { ...component.profile!, role };
      expect(component.canSignVisa(director)).toBe(role === 0 || role === 3 || role === 4);
    }
  });

  it("utilise le nom configuré dans le profil pour le nouveau visa", () => {
    const component = createPage().componentInstance;
    component.profile = {
      ...component.profile!, role: 1, signatureName: "Nom du visa"
    };
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch").mockClear();

    component.signItem(component.validationItems.find(item => item.kind === "regular-period-agent")!);

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      field: "agentVisa",
      periodId: period.id,
      visa: expect.objectContaining({
        signed: true, signedByName: "Nom du visa", signatureValue: "Nom du visa",
      }),
    }));
  });

  it.each([0, 1, 2, 3, 4] as const)("réserve l'envoi RH du directeur au profil autorisé %s", role => {
    const component = createPage().componentInstance;
    const signed = { ...createEmptyVisa(), signed: true };
    component.regularPeriods = [{ ...period, agentVisa: signed, directorVisa: signed }];
    component.regularInterventions = [{ ...intervention, agentVisa: signed }];
    component.profile = { ...component.profile!, role: 0 };
    const item = component.directorVisaItems[0];
    const agentItem = component.validationItems.find(item => item.kind === "regular-period-agent")!;
    component.profile = { ...component.profile!, role };
    const allowed = role === 0 || role === 3 || role === 4;
    expect(component.canManageRhSend(agentItem)).toBe(false);
    expect(component.canSendToRh(item)).toBe(allowed);
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch").mockClear();
    component.updateRhSend(item, true);
    expect(dispatch).toHaveBeenCalledTimes(allowed ? 1 : 0);
    if (allowed) expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ periodId: period.id, sent: true }));
    // A stale row must see the new source state before sending or cancelling.
    component.regularPeriods = [{ ...component.regularPeriods[0], sentToRhAt: "2026-10-24T08:00:00Z" }];
    expect(component.isItemSentToRh(item)).toBe(true);
    expect(component.canSendToRh(item)).toBe(false);
    dispatch.mockClear();
    component.updateRhSend(item, false);
    expect(dispatch).toHaveBeenCalledTimes(allowed ? 1 : 0);
    if (allowed) expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ periodId: period.id, sent: false }));
    component.regularPeriods = [{ ...period, agentVisa: signed, directorVisa: signed }];
    component.regularInterventions = [intervention];
    expect(component.canSendToRh(item)).toBe(false);
  });

  it.each(["astreinte", "travaux"] as const)("déplace l'envoi RH %s dans les actions du directeur", type => {
    const fixture = createPage();
    const component = fixture.componentInstance;
    const signed = { ...createEmptyVisa(), signed: true };
    component.profile = { ...component.profile!, role: 3 };
    component.exceptionalOperations = [{
      id: `${type}:11`, type, title: "Opération", initiatorUid: "7", initiatorName: "Agent",
      operationManagerUid: "7", operationManagerName: "Agent", startDate: period.startDate,
      forecastEndDate: period.endDate, actualStartDate: period.startDate, actualEndDate: period.endDate,
      plannedUsers: [], actualUsers: [], interventions: [], visas: { initiatorGlobal: signed, directorGlobal: signed },
    }];
    component.activeSectionId = "director";
    fixture.detectChanges();
    const item = component.directorVisaItems[0];
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch").mockClear();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll(".actions button")) as HTMLButtonElement[];
    const send = buttons.find(button => button.textContent?.includes(component.labels.common.actions.rhSend))!;
    expect(send.disabled).toBe(false);
    send.click();
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ operationId: item.payload.id, sent: true }));
    component.exceptionalOperations = [{ ...component.exceptionalOperations[0], sentToRhAt: "2026-10-24T08:00:00Z" }];
    fixture.detectChanges();
    const cancel = (Array.from(fixture.nativeElement.querySelectorAll(".actions button")) as HTMLButtonElement[])
      .find(button => button.textContent?.includes(component.labels.common.actions.cancelRhSend))!;
    cancel.click();
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ operationId: item.payload.id, sent: false }));
    component.exceptionalOperations = [{ ...component.exceptionalOperations[0], sentToRhAt: undefined,
      visas: { initiatorGlobal: signed, directorGlobal: createEmptyVisa() } }];
    dispatch.mockClear();
    component.updateRhSend(item, true);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("filters all director operation families by direction and restores every row with All", () => {
    const component = createPage().componentInstance;
    const signed = { ...createEmptyVisa(), signed: true };
    component.profile = { ...component.profile!, role: 3 };
    component.regularPeriods = [{ ...period, directionId: "1", agentVisa: signed }];
    component.regularInterventions = [{ ...intervention, agentVisa: signed }];
    const exceptional = {
      initiatorUid: "7", initiatorName: "Agent", operationManagerUid: "7", operationManagerName: "Agent",
      startDate: period.startDate, forecastEndDate: period.endDate, actualStartDate: period.startDate,
      actualEndDate: period.endDate, plannedUsers: [], actualUsers: [], interventions: [],
      visas: { initiatorGlobal: signed, plannedInitiator: signed, actualInitiator: signed, plannedDirector: signed, actualDirector: signed },
    };
    component.exceptionalOperations = [
      { ...exceptional, id: "astreinte:1", type: "astreinte", title: "Astreinte", directionId: "2" },
      { ...exceptional, id: "travaux:1", type: "travaux", title: "Travaux", directionId: "1" },
    ];
    expect(component.directorVisaItems).toHaveLength(3);
    component.selectedDirectionId = "1";
    expect(component.directorVisaItems.map(item => item.kind)).toEqual(expect.arrayContaining(["regular-period-director", "exceptional-operation-director"]));
    expect(component.directorVisaItems).toHaveLength(2);
    component.selectedDirectionId = "2";
    expect(component.directorVisaItems.map(item => item.payload.id)).toEqual(["astreinte:1"]);
    expect(component.directionName(component.directorVisaItems[0])).toBe("Services");
    component.selectedDirectionId = "";
    expect(component.directorVisaItems).toHaveLength(3);
    expect(component.directionOptions[0].name).toBe(component.labels.directions.all);
  });

  it("autorise l'administrateur à retirer tout visa et refuse la signature sans profil", () => {
    const component = createPage().componentInstance;
    const own = component.validationItems[0];
    const signed = { ...own, visa: { ...createEmptyVisa(), signed: true, signedByUid: 'other-auth' } };
    component.profile = { ...component.profile!, role: 0 };
    expect(component.canDeleteVisa(signed)).toBe(true);
    component.profile = null;
    expect(component.canSignVisa(own)).toBe(false);
    expect(component.canDeleteVisa(signed)).toBe(false);
  });
});
