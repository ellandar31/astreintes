import { createActionGroup, emptyProps, props } from "@ngrx/store";
import { SignatureProfile } from "../../shared/visa.models";
import { StoreAuthUser } from "../../store/app-store";

export const ProfileActions = createActionGroup({
  source: "Profile",
  events: {
    "Watch Started": props<{ user: StoreAuthUser }>(),
    "Watch Stopped": emptyProps(),
    "Profile Changed": props<{ profile: SignatureProfile }>(),
    "Profile Load Failed": props<{ message: string }>(),
    "Save Requested": props<{ profile: SignatureProfile; user: StoreAuthUser }>(),
    "Save Succeeded": props<{ completedAt: number; message: string }>(),
    "Save Failed": props<{ message: string }>(),
    "Message Cleared": emptyProps(),
  },
});
