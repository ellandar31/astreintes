import { createActionGroup, emptyProps, props } from "@ngrx/store";
import {
  ManagedUser,
  PublicHoliday,
  RhCompensationSettings,
  RhExportTemplateSetting,
  Team,
  UserRole,
} from "../../pages/settings/settings.models";

export type SettingsMessageSource = "users" | "teams" | "holidays" | "rhCompensation" | "rhTemplates";
export type SettingsMessageKind = "success" | "failure";

export const SettingsActions = createActionGroup({
  source: "Settings",
  events: {
    "Users Watch Started": emptyProps(),
    "Users Watch Stopped": emptyProps(),
    "Users Changed": props<{ users: ManagedUser[] }>(),
    "User Role Update Requested": props<{ role: UserRole; userId: string }>(),
    "User Delete Requested": props<{ userId: string }>(),
    "Teams Watch Started": emptyProps(),
    "Teams Watch Stopped": emptyProps(),
    "Teams Changed": props<{ teams: Team[] }>(),
    "Team Save Requested": props<{ editingTeamId: string | null; team: Omit<Team, "id"> }>(),
    "Team Delete Requested": props<{ teamId: string }>(),
    "Holidays Watch Started": emptyProps(),
    "Holidays Watch Stopped": emptyProps(),
    "Holidays Changed": props<{ holidays: PublicHoliday[] }>(),
    "Official Holidays Load Requested": props<{ year: number; zone: string }>(),
    "Official Holidays Loaded": props<{ holidays: PublicHoliday[] }>(),
    "Imported Holidays Save Requested": props<{ holidays: PublicHoliday[] }>(),
    "Manual Holiday Save Requested": props<{ holiday: PublicHoliday }>(),
    "Holiday Delete Requested": props<{ holidayId: string }>(),
    "Rh Compensation Watch Started": emptyProps(),
    "Rh Compensation Watch Stopped": emptyProps(),
    "Rh Compensation Changed": props<{ settings: RhCompensationSettings }>(),
    "Rh Compensation Save Requested": props<{ settings: RhCompensationSettings }>(),
    "Rh Templates Watch Started": emptyProps(),
    "Rh Templates Watch Stopped": emptyProps(),
    "Rh Templates Changed": props<{ templates: RhExportTemplateSetting[] }>(),
    "Rh Templates Save Requested": props<{ templates: RhExportTemplateSetting[] }>(),
    "Operation Succeeded": props<{ completedAt: number; message: string; source: SettingsMessageSource }>(),
    "Operation Failed": props<{ completedAt: number; message: string; source: SettingsMessageSource }>(),
  },
});
