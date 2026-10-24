import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, effect, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Store } from "@ngrx/store";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { InputTextModule } from "primeng/inputtext";
import { MessageModule } from "primeng/message";
import { APP_LABELS } from "../../i18n/labels";
import { SignatureProfile } from "../../shared/visa.models";
import { StoreAuthUser } from "../../store/app-store";
import { selectCurrentApplicationUser } from "../../state/settings/settings.selectors";
import { ProfileActions } from "../../state/profile/profile.actions";
import {
  selectProfile,
  selectProfileIsSaving,
  selectProfileMessage,
  selectProfileSaveCompletedAt,
} from "../../state/profile/profile.selectors";

@Component({
  selector: "app-profile-page",
  standalone: true,
  imports: [ButtonModule, CardModule, CommonModule, FormsModule, InputTextModule, MessageModule],
  templateUrl: "./profile-page.component.html",
  styleUrl: "./profile-page.component.css",
})
export class ProfilePageComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) user: StoreAuthUser | null = null;

  @Output() saved = new EventEmitter<void>();

  readonly labels = APP_LABELS;
  profile: SignatureProfile = this.emptyProfile();

  private readonly store = inject(Store);
  private readonly savedProfile = this.store.selectSignal(selectProfile);
  private readonly saveCompletedAt = this.store.selectSignal(selectProfileSaveCompletedAt);
  private lastHandledSaveCompletion: number | null = null;

  // Administrative account data stays outside the editable signature profile.
  readonly applicationUser = this.store.selectSignal(selectCurrentApplicationUser);
  readonly isSaving = this.store.selectSignal(selectProfileIsSaving);
  readonly message = this.store.selectSignal(selectProfileMessage);

  constructor() {
    effect(() => {
      const profile = this.savedProfile();

      if (profile) {
        this.profile = { ...profile };
      }
    });

    effect(() => {
      const completedAt = this.saveCompletedAt();

      if (completedAt && completedAt !== this.lastHandledSaveCompletion) {
        this.lastHandledSaveCompletion = completedAt;
        this.saved.emit();
      }
    });
  }

  get email(): string {
    return this.user?.email || this.labels.common.users.unspecified;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes["user"]) {
      return;
    }

    if (!this.user) {
      this.profile = this.emptyProfile();
      this.store.dispatch(ProfileActions.watchStopped());
      return;
    }

    this.store.dispatch(ProfileActions.watchStarted({ user: this.user }));
  }

  ngOnDestroy(): void {
    this.store.dispatch(ProfileActions.watchStopped());
  }

  saveProfile(): void {
    if (!this.user) {
      return;
    }

    this.store.dispatch(ProfileActions.saveRequested({ profile: { ...this.profile }, user: this.user }));
  }

  private emptyProfile(): SignatureProfile {
    return {
      displayName: "",
      signatureName: "",
    };
  }
}
