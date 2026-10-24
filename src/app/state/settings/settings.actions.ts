import { createActionGroup, emptyProps, props } from "@ngrx/store";
import {
  Direction,
  ManagedUser,
  PublicHoliday,
  RhCompensationSettings,
  Team,
  UserRole,
} from "../../pages/settings/settings.models";

export type SettingsMessageSource = "directions" | "users" | "teams" | "holidays" | "rhCompensation";
export type SettingsMessageKind = "success" | "failure";

export const SettingsActions = createActionGroup({
  source: "Settings",
  events: {
    "Directions Changed": props<{ directions: Direction[] }>(),
    "Direction Save Requested": props<{ directionId: string | null; name: string }>(),
    "Direction Delete Requested": props<{ directionId: string }>(),
    "Users Watch Started": emptyProps(),
    "Users Watch Stopped": emptyProps(),
    "Users Changed": props<{ users: ManagedUser[] }>(),
    "User Role Update Requested": props<{ role: UserRole; userId: string; directionId?: string | null; isRh?: boolean }>(),
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
    "Operation Succeeded": props<{ completedAt: number; message: string; source: SettingsMessageSource }>(),
    "Operation Failed": props<{ completedAt: number; message: string; source: SettingsMessageSource }>(),
  },
});
