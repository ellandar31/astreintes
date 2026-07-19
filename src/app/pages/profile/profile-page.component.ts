import { CommonModule } from "@angular/common";
import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, effect, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Store } from "@ngrx/store";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { InputTextModule } from "primeng/inputtext";
import { MessageModule } from "primeng/message";
import { SelectButtonModule } from "primeng/selectbutton";
import { APP_LABELS } from "../../i18n/labels";
import { SignatureProfile, VisaSignatureMode } from "../../shared/visa.models";
import { StoreAuthUser } from "../../store/app-store";
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
  imports: [ButtonModule, CardModule, CommonModule, FormsModule, InputTextModule, MessageModule, SelectButtonModule],
  templateUrl: "./profile-page.component.html",
  styleUrl: "./profile-page.component.css",
})
export class ProfilePageComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) user: StoreAuthUser | null = null;

  @Output() saved = new EventEmitter<void>();

  @ViewChild("signaturePad") signaturePad?: ElementRef<HTMLCanvasElement>;

  readonly labels = APP_LABELS;
  readonly signatureModeOptions: { label: string; value: VisaSignatureMode }[] = [
    { label: APP_LABELS.profile.modes.name, value: "name" },
    { label: APP_LABELS.profile.modes.image, value: "image" },
    { label: APP_LABELS.profile.modes.draw, value: "draw" },
  ];
  profile: SignatureProfile = this.emptyProfile();
  isDrawing = false;

  private readonly store = inject(Store);
  private readonly savedProfile = this.store.selectSignal(selectProfile);
  private readonly saveCompletedAt = this.store.selectSignal(selectProfileSaveCompletedAt);
  private lastHandledSaveCompletion: number | null = null;

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

  get displayName(): string {
    return this.profile.displayName || this.user?.displayName || "";
  }

  get displayedName(): string {
    return this.displayName || this.labels.common.users.unspecified;
  }

  get email(): string {
    return this.user?.email || this.labels.common.users.unspecified;
  }

  get signaturePreview(): string {
    if (this.profile.signatureMode === "image") {
      return this.profile.signatureImage || "";
    }

    if (this.profile.signatureMode === "draw") {
      return this.profile.signatureDrawing || "";
    }

    return "";
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

  updateSignatureMode(mode: VisaSignatureMode): void {
    this.profile.signatureMode = mode;
  }

  loadSignatureImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.profile.signatureImage = typeof reader.result === "string" ? reader.result : "";
      this.profile.signatureMode = "image";
    };
    reader.readAsDataURL(file);
  }

  startDrawing(event: MouseEvent | TouchEvent): void {
    this.isDrawing = true;
    this.draw(event);
  }

  draw(event: MouseEvent | TouchEvent): void {
    if (!this.isDrawing || !this.signaturePad) {
      return;
    }

    event.preventDefault();
    const canvas = this.signaturePad.nativeElement;
    const context = canvas.getContext("2d");
    const point = this.pointerPosition(event, canvas);

    if (!context) {
      return;
    }

    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--app-color-heading-strong")
      .trim();
    context.lineTo(point.x, point.y);
    context.stroke();
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  stopDrawing(): void {
    if (!this.isDrawing || !this.signaturePad) {
      return;
    }

    const context = this.signaturePad.nativeElement.getContext("2d");
    context?.beginPath();
    this.isDrawing = false;
    this.profile.signatureDrawing = this.signaturePad.nativeElement.toDataURL("image/png");
    this.profile.signatureMode = "draw";
  }

  clearDrawing(): void {
    if (!this.signaturePad) {
      return;
    }

    const canvas = this.signaturePad.nativeElement;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    this.profile.signatureDrawing = "";
  }

  private emptyProfile(): SignatureProfile {
    return {
      displayName: "",
      signatureMode: "name",
      signatureName: "",
      signatureImage: "",
      signatureDrawing: "",
    };
  }

  private pointerPosition(event: MouseEvent | TouchEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const point = event instanceof MouseEvent ? event : event.touches[0];

    return {
      x: ((point.clientX - rect.left) / rect.width) * canvas.width,
      y: ((point.clientY - rect.top) / rect.height) * canvas.height,
    };
  }
}
