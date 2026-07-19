import { createActionGroup, emptyProps, props } from "@ngrx/store";
import { StoreAuthUser } from "../../store/app-store";

export const AuthActions = createActionGroup({
  source: "Auth",
  events: {
    "Session Watch Started": emptyProps(),
    "Session Changed": props<{ user: StoreAuthUser | null }>(),
    "Session Registration Failed": props<{ error: string }>(),
    "Email Login Requested": props<{ email: string; password: string; createAccount: boolean }>(),
    "Email Login Form Invalid": props<{ error: string }>(),
    "Error Cleared": emptyProps(),
    "Google Login Requested": emptyProps(),
    "Login Failed": props<{ error: string }>(),
    "Logout Requested": emptyProps(),
    "Logout Failed": props<{ error: string }>(),
    "Operation Completed": emptyProps(),
  },
});
