import { TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { MockStore, provideMockStore } from "@ngrx/store/testing";
import { selectExceptionalError, selectExceptionalOperations } from "../../state/exceptional/exceptional.selectors";
import { selectRegularError, selectRegularInterventions, selectRegularPeriods, selectRegularTeams } from "../../state/regular/regular.selectors";
import { selectSettingsMessage, selectSettingsUsers } from "../../state/settings/settings.selectors";
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
    component.openItem(component.validationItems.find(item => item.payload.id === operation.id)!);
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

  it.each(["image", "draw"] as const)("utilise le nom pour un nouveau visa avec un ancien profil %s", (signatureMode) => {
    const component = createPage().componentInstance;
    component.profile = {
      ...component.profile!, role: 1, signatureName: "Nom du visa", signatureMode,
      signatureImage: "data:image/png;base64,aW1hZ2U=",
      signatureDrawing: "data:image/png;base64,ZGVzc2lu",
    };
    const dispatch = jest.spyOn(TestBed.inject(MockStore), "dispatch").mockClear();

    component.signItem(component.validationItems.find(item => item.kind === "regular-period-agent")!);

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      field: "agentVisa",
      periodId: period.id,
      visa: expect.objectContaining({
        signed: true, signedByName: "Nom du visa", signatureMode: "name", signatureValue: "Nom du visa",
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
