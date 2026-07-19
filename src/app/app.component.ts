import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { Store } from "@ngrx/store";
import { APP_LABELS } from "./i18n/labels";
import { ExceptionalOperationsComponent } from "./pages/exceptionnel/exceptional-operations.component";
import { ProfilePageComponent } from "./pages/profile/profile-page.component";
import { RegularCalendarComponent } from "./pages/regular/regular-calendar.component";
import { RhPageComponent } from "./pages/rh/rh-page.component";
import { SettingsPageComponent } from "./pages/settings/settings-page.component";
import { ValidationPageComponent } from "./pages/validation/validation-page.component";
import { ModalComponent } from "./shared/modal.component";
import { AuthActions } from "./state/auth/auth.actions";
import {
  selectAuthError,
  selectAuthUser,
  selectDisplayName,
  selectIsSubmitting,
  selectLoadingSession,
} from "./state/auth/auth.selectors";

const tabs = [
  { id: "regular", label: APP_LABELS.app.tabs.regular },
  { id: "exceptional", label: APP_LABELS.app.tabs.exceptional },
  { id: "validation", label: APP_LABELS.app.tabs.validation },
  { id: "rh", label: APP_LABELS.app.tabs.rh },
] as const;
type TabId = (typeof tabs)[number]["id"];
type ModalView = "profile" | "settings";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    ExceptionalOperationsComponent,
    FormsModule,
    ModalComponent,
    ProfilePageComponent,
    RegularCalendarComponent,
    RhPageComponent,
    SettingsPageComponent,
    ValidationPageComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  readonly labels = APP_LABELS;
  readonly tabs = tabs;
  activeTab: TabId = "regular";
  email = "";
  isCreatingAccount = false;
  modalView: ModalView | null = null;
  password = "";
  private readonly store = inject(Store);
  readonly displayName = this.store.selectSignal(selectDisplayName);
  readonly error = this.store.selectSignal(selectAuthError);
  readonly isSubmitting = this.store.selectSignal(selectIsSubmitting);
  readonly loadingSession = this.store.selectSignal(selectLoadingSession);
  readonly user = this.store.selectSignal(selectAuthUser);

  constructor() {
    // La surveillance Firebase devient une action NgRx pour éviter que le shell
    // porte directement la logique de session et de synchronisation utilisateur.
    this.store.dispatch(AuthActions.sessionWatchStarted());
  }

  selectTab(tabId: TabId): void {
    this.activeTab = tabId;
  }

  showProfile(): void {
    this.modalView = "profile";
  }

  showSettings(): void {
    this.modalView = "settings";
  }

  closeModal(): void {
    this.modalView = null;
  }

  loginWithEmail(form: NgForm): void {
    if (form.invalid) {
      this.store.dispatch(
        AuthActions.emailLoginFormInvalid({
          error: this.labels.app.auth.invalidForm,
        }),
      );
      return;
    }

    this.store.dispatch(
      AuthActions.emailLoginRequested({
        email: this.email,
        password: this.password,
        createAccount: this.isCreatingAccount,
      }),
    );
  }

  loginWithGoogle(): void {
    this.store.dispatch(AuthActions.googleLoginRequested());
  }

  logout(): void {
    this.store.dispatch(AuthActions.logoutRequested());
  }

  toggleAccountMode(): void {
    this.isCreatingAccount = !this.isCreatingAccount;
    this.store.dispatch(AuthActions.errorCleared());
  }
}
