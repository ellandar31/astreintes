import { ApplicationConfig } from "@angular/core";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { provideEffects } from "@ngrx/effects";
import { provideStore } from "@ngrx/store";
import { providePrimeNG } from "primeng/config";
import Aura from "@primeuix/themes/aura";
import { appReducers } from "./state/app.state";
import { AuthEffects } from "./state/auth/auth.effects";
import { ExceptionalEffects } from "./state/exceptional/exceptional.effects";
import { ProfileEffects } from "./state/profile/profile.effects";
import { RegularEffects } from "./state/regular/regular.effects";
import { SettingsEffects } from "./state/settings/settings.effects";

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: false,
        },
      },
    }),
    provideStore(appReducers),
    provideEffects(AuthEffects, ExceptionalEffects, ProfileEffects, RegularEffects, SettingsEffects),
  ],
};
