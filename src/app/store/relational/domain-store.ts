import { SupabaseClient } from "@supabase/supabase-js";
import {
  ApplicationUser, DomainObserver, ExceptionalOperation, ExceptionalOperationType, ExceptionalOperationUpdate,
  PublicHoliday, RegularIntervention, RegularInterventionUpdate, RegularOnCallPeriod,
  RegularPeriodUpdate, RhCompensationSettings, RhExportConfiguration, RhExportTemplateSetting,
  ScheduleRule, Team,
} from "../../types";
import { DomainObserverService } from "./domain-observer";
import { ExceptionalRepository } from "./exceptional.repository";
import { HolidaysRepository } from "./holidays.repository";
import { RegularRepository } from "./regular.repository";
import { RhSettingsRepository } from "./rh-settings.repository";
import { ScheduleRepository } from "./schedule.repository";
import { TeamsRepository } from "./teams.repository";
import { UsersRepository } from "./users.repository";
import { VisasRepository } from "./visas.repository";
import { VisaWorkflowPersistence } from "./visa-workflow.persistence";
import { deleteById, numberId } from "./store-utils";
import { RelationalTable } from "./store-types";

const periodTables: RelationalTable[] = ["regular_on_call_periods", "visas", "app_users"];
const interventionTables: RelationalTable[] = ["regular_interventions", "visas", "app_users"];
const operationTables: RelationalTable[] = [
  "exceptional_on_calls", "exceptional_works", "exceptional_on_call_participants", "exceptional_work_participants",
  "exceptional_on_call_interventions", "exceptional_on_call_visas", "exceptional_work_visas", "app_users",
];

/**
 * Typed persistence API used by effects. Repositories return business objects
 * directly; database columns, joins and timestamp conversions stay behind this boundary.
 */
export class SupabaseDomainStore {
  readonly users;
  readonly teams;
  readonly schedule;
  readonly holidays;
  readonly regular;
  readonly exceptional;
  readonly rhSettings;

  constructor(client: SupabaseClient) {
    const observer = new DomainObserverService(client);
    const users = new UsersRepository(client);
    const visas = new VisasRepository(client, users);
    const teams = new TeamsRepository(client, users);
    const schedule = new ScheduleRepository(client);
    const holidays = new HolidaysRepository(client);
    const regular = new RegularRepository(client, users, visas);
    const exceptional = new ExceptionalRepository(client, users, visas);
    const visaWorkflow = new VisaWorkflowPersistence(regular, exceptional);
    const rh = new RhSettingsRepository(client);
    const watch = <T>(tables: RelationalTable[], load: () => Promise<T>): DomainObserver<T> =>
      (next, error) => observer.watch(tables, load, next, error);
    const remove = (table: RelationalTable, id: string) => observer.write([table], () => deleteById(client, table, numberId(id)));

    this.users = {
      list: () => users.fetchUsers(),
      get: (identifier: string) => users.fetchUser(identifier),
      watch: watch<ApplicationUser[]>(["app_users"], () => users.fetchUsers()),
      watchOne: (identifier: string, next: (user: ApplicationUser | undefined) => void, error?: (error: unknown) => void) =>
        observer.watch(["app_users"], () => users.fetchUser(identifier), next, error),
      save: (identifier: string, update: Partial<ApplicationUser>) => observer.write(["app_users"], () => users.saveUser(identifier, update)),
      remove: (identifier: string) => observer.write(["app_users"], () => users.deleteUser(identifier)),
    };
    this.teams = {
      list: () => teams.fetchTeams(),
      watch: watch<Team[]>(["teams", "team_members"], () => teams.fetchTeams()),
      save: (id: string | undefined, team: Omit<Team, "id">) => observer.write(["teams", "team_members"], () => teams.saveTeam(id, team)),
      remove: (id: string) => remove("teams", id),
    };
    this.schedule = {
      list: () => schedule.fetchScheduleRules(),
      watch: watch<ScheduleRule[]>(["schedule_rules"], () => schedule.fetchScheduleRules()),
      save: (id: string, rule: Omit<ScheduleRule, "id">) => observer.write(["schedule_rules"], () => schedule.saveScheduleRule(id, rule)),
      remove: (id: string) => remove("schedule_rules", id),
    };
    this.holidays = {
      list: () => holidays.fetchPublicHolidays(),
      watch: watch<PublicHoliday[]>(["public_holidays"], () => holidays.fetchPublicHolidays()),
      save: (id: string, holiday: Omit<PublicHoliday, "id">) => observer.write(["public_holidays"], () => holidays.savePublicHoliday(id, holiday)),
      remove: (id: string) => remove("public_holidays", id),
    };
    this.regular = {
      listPeriods: () => regular.fetchRegularPeriods(),
      watchPeriods: watch<RegularOnCallPeriod[]>(periodTables, () => regular.fetchRegularPeriods()),
      listInterventions: (periodId?: string) => regular.fetchRegularInterventions(periodId),
      watchInterventions: watch<RegularIntervention[]>(interventionTables, () => regular.fetchRegularInterventions()),
      savePeriod: (id: string | undefined, update: RegularPeriodUpdate) => observer.write(["regular_on_call_periods", "visas"], () => visaWorkflow.savePeriod(id, update)),
      updatePeriod: (id: string, update: RegularPeriodUpdate) => observer.write(["regular_on_call_periods", "visas"], () => visaWorkflow.savePeriod(id, update)),
      deletePeriod: (id: string) => observer.write(["regular_on_call_periods", "regular_interventions", "visas"], () => deleteById(client, "regular_on_call_periods", numberId(id))),
      saveIntervention: (id: string | undefined, periodId: string, update: RegularInterventionUpdate) =>
        observer.write(["regular_interventions", "visas"], () => visaWorkflow.saveIntervention(id, periodId, update)),
      updateIntervention: (id: string, periodId: string, update: RegularInterventionUpdate) => observer.write(["regular_interventions", "visas"], () => visaWorkflow.saveIntervention(id, periodId, update)),
      deleteIntervention: (id: string) => observer.write(["regular_interventions", "visas"], () => deleteById(client, "regular_interventions", numberId(id))),
    };
    this.exceptional = {
      listOperations: (type?: ExceptionalOperationType) => exceptional.fetchExceptionalOperations(type),
      watchOperations: watch<ExceptionalOperation[]>(operationTables, () => exceptional.fetchExceptionalOperations()),
      saveOperation: (id: string | undefined, update: ExceptionalOperationUpdate) => observer.write(operationTables.filter(table => table !== "app_users"), () => visaWorkflow.saveOperation(id, update)),
      deleteOperation: (id: string) => observer.write(operationTables.filter(table => table !== "app_users"), () => exceptional.deleteExceptionalOperation(id)),
    };
    this.rhSettings = {
      compensation: () => rh.fetchRhCompensation(),
      watchCompensation: watch<RhCompensationSettings>(["rh_on_call_compensation_rules", "rh_period_compensation_rules"], () => rh.fetchRhCompensation()),
      saveCompensation: (settings: RhCompensationSettings) => observer.write(["rh_on_call_compensation_rules", "rh_period_compensation_rules"], () => rh.saveRhCompensation(settings)),
      exportConfiguration: () => rh.fetchRhExportSettings(),
      watchExportConfiguration: watch<RhExportConfiguration>(["rh_export_settings"], () => rh.fetchRhExportSettings()),
      saveExportConfiguration: (settings: RhExportConfiguration) => observer.write(["rh_export_settings"], () => rh.saveRhExportSettings(settings)),
      templates: () => rh.fetchRhExportTemplateItems(),
      watchTemplates: watch<RhExportTemplateSetting[]>(["rh_export_templates"], () => rh.fetchRhExportTemplateItems()),
      saveTemplate: (template: RhExportTemplateSetting) => observer.write(["rh_export_templates"], () => rh.saveRhExportTemplateItem(template.id, template)),
    };
  }
}
