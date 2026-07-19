import { createActionGroup, emptyProps, props } from "@ngrx/store";
import {
  ExceptionalIntervention,
  ExceptionalOperation,
  SelectableUser,
} from "../../pages/exceptionnel/exceptional.models";

export const ExceptionalActions = createActionGroup({
  source: "Exceptional",
  events: {
    "Watch Started": emptyProps(),
    "Watch Stopped": emptyProps(),
    "Operations Changed": props<{ operations: ExceptionalOperation[] }>(),
    "Users Changed": props<{ users: SelectableUser[] }>(),
    "Load Failed": props<{ message: string }>(),
    "Operation Save Requested": props<{
      operationId: string | null;
      payload: Record<string, unknown>;
    }>(),
    "Operation Patch Requested": props<{
      operationId: string;
      payload: Record<string, unknown>;
    }>(),
    "Operation Delete Requested": props<{ operationId: string }>(),
    "Interventions Save Requested": props<{
      operationId: string;
      interventions: ExceptionalIntervention[];
    }>(),
    "Operation Rh Sent Update Requested": props<{
      operationId: string;
      sent: boolean;
    }>(),
    "Operation Failed": props<{ message: string }>(),
    "Operation Succeeded": emptyProps(),
  },
});
