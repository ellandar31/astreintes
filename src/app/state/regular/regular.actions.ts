import { createActionGroup, emptyProps, props } from "@ngrx/store";
import {
  RegularIntervention,
  RegularInterventionForm,
  RegularOnCallPeriod,
  RegularOnCallPeriodForm,
  RegularPublicHoliday,
  RegularTeam,
  RegularUser,
} from "../../pages/regular/regular.models";
import { SignatureVisa } from "../../shared/visa.models";

export const RegularActions = createActionGroup({
  source: "Regular",
  events: {
    "Watch Started": emptyProps(),
    "Watch Stopped": emptyProps(),
    "Teams Changed": props<{ teams: RegularTeam[] }>(),
    "Users Changed": props<{ users: RegularUser[] }>(),
    "Periods Changed": props<{ periods: RegularOnCallPeriod[] }>(),
    "Interventions Changed": props<{ interventions: RegularIntervention[] }>(),
    "Public Holidays Changed": props<{ publicHolidays: RegularPublicHoliday[] }>(),
    "Load Failed": props<{ message: string }>(),
    "Period Save Requested": props<{
      editingPeriodId: string | null;
      form: RegularOnCallPeriodForm;
      selectedTeamId: string;
      existingAgentVisa?: SignatureVisa;
      existingDirectorVisa?: SignatureVisa;
    }>(),
    "Period Delete Requested": props<{ interventions: Array<{ id: string; periodId: string }>; periodId: string }>(),
    "Intervention Save Requested": props<{
      editingInterventionId: string | null;
      existingIntervention?: RegularIntervention;
      form: RegularInterventionForm;
      parentPeriod: RegularOnCallPeriod;
    }>(),
    "Intervention Delete Requested": props<{ interventionId: string; periodId: string }>(),
    "Period Visa Update Requested": props<{
      periodId: string;
      field: "agentVisa" | "directorVisa";
      visa: SignatureVisa;
    }>(),
    "Intervention Visa Update Requested": props<{
      interventionId: string;
      periodId: string;
      visa: SignatureVisa;
    }>(),
    "Interventions Visa Batch Update Requested": props<{
      interventions: Array<{ id: string; periodId: string }>;
      visa: SignatureVisa;
    }>(),
    "Period Rh Sent Update Requested": props<{
      periodId: string;
      sent: boolean;
    }>(),
    "Operation Failed": props<{ message: string }>(),
    "Operation Succeeded": emptyProps(),
  },
});
