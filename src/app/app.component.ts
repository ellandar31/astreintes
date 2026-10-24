import { CommonModule } from "@angular/common";
import { Component, effect, inject } from "@angular/core";
import { FormsModule, NgForm } from "@angular/forms";
import { Store } from "@ngrx/store";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { InputTextModule } from "primeng/inputtext";
import { MessageModule } from "primeng/message";
import { PasswordModule } from "primeng/password";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { TooltipModule } from "primeng/tooltip";
import { APP_LABELS } from "./i18n/labels";
import { ExceptionalOnCallPageComponent } from "./pages/exceptional-on-call/exceptional-on-call-page.component";
import { ExceptionalWorkPageComponent } from "./pages/exceptional-work/exceptional-work-page.component";
import { ProfilePageComponent } from "./pages/profile/profile-page.component";
import { RegularCalendarComponent } from "./pages/regular/regular-calendar.component";
import { RhPageComponent } from "./pages/rh/rh-page.component";
import { HistoryPageComponent } from "./pages/history/history-page.component";
import { SettingsPageComponent } from "./pages/settings/settings-page.component";
import { ValidationPageComponent } from "./pages/validation/validation-page.component";
import { ModalComponent } from "./shared/modal.component";
import { AuthActions } from "./state/auth/auth.actions";
import { selectCanOpenSettings, selectCanExportRh } from "./state/settings/settings.selectors";
import {
  selectAuthError,
  selectAuthUser,
  selectDisplayName,
  selectIsSubmitting,
  selectLoadingSession,
} from "./state/auth/auth.selectors";

const tabs = [
  { id: "regular", label: APP_LABELS.app.tabs.regular },
  { id: "exceptionalOnCall", label: APP_LABELS.app.tabs.exceptionalOnCall },
  { id: "exceptionalWork", label: APP_LABELS.app.tabs.exceptionalWork },
  { id: "validation", label: APP_LABELS.app.tabs.validation },
  { id: "rh", label: APP_LABELS.app.tabs.rh },
  { id: "history", label: APP_LABELS.app.tabs.history },
] as const;
type TabId = (typeof tabs)[number]["id"];
type ModalView = "profile" | "settings";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    ExceptionalOnCallPageComponent,
    ExceptionalWorkPageComponent,
    FormsModule,
    InputTextModule,
    MessageModule,
    ModalComponent,
    PasswordModule,
    ProfilePageComponent,
    ProgressSpinnerModule,
    RegularCalendarComponent,
    RhPageComponent,
    HistoryPageComponent,
    SettingsPageComponent,
    TooltipModule,
    ValidationPageComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  readonly labels = APP_LABELS;
  get tabs() { return tabs.filter(tab => tab.id !== "rh" || this.canExportRh()); }
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
  readonly canOpenSettings = this.store.selectSignal(selectCanOpenSettings);
  readonly canExportRh = this.store.selectSignal(selectCanExportRh);

  constructor() {
    // La surveillance d'authentification devient une action NgRx pour éviter que le shell
    // porte directement la logique de session et de synchronisation utilisateur.
    this.store.dispatch(AuthActions.sessionWatchStarted());
    effect(() => {
      if (!this.canOpenSettings() && this.modalView === "settings") {
        this.closeModal();
      }
      if (!this.canExportRh() && this.activeTab === "rh") this.activeTab = "history";
    });
  }

  selectTab(tabId: TabId): void {
    this.activeTab = tabId;
  }

  showProfile(): void {
    this.modalView = "profile";
  }

  showSettings(): void {
    if (!this.canOpenSettings()) return;
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

  logout(): void {
    this.store.dispatch(AuthActions.logoutRequested());
  }

  toggleAccountMode(): void {
    this.isCreatingAccount = !this.isCreatingAccount;
    this.store.dispatch(AuthActions.errorCleared());
  }
}
