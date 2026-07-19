import { ApplicationConfig } from "@angular/core";
import { provideEffects } from "@ngrx/effects";
import { provideStore } from "@ngrx/store";
import { appReducers } from "./state/app.state";
import { AuthEffects } from "./state/auth/auth.effects";
import { ExceptionalEffects } from "./state/exceptional/exceptional.effects";
import { ProfileEffects } from "./state/profile/profile.effects";
import { RegularEffects } from "./state/regular/regular.effects";
import { SettingsEffects } from "./state/settings/settings.effects";

export const appConfig: ApplicationConfig = {
  providers: [
    provideStore(appReducers),
    provideEffects(AuthEffects, ExceptionalEffects, ProfileEffects, RegularEffects, SettingsEffects),
  ],
};
