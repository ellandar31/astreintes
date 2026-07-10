import { CommonModule } from "@angular/common";
import { Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { User, updateProfile } from "firebase/auth";
import { Unsubscribe, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { SignatureProfile, VisaSignatureMode } from "../../shared/visa.models";

@Component({
  selector: "app-profile-page",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./profile-page.component.html",
  styleUrl: "./profile-page.component.css",
})
export class ProfilePageComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) user: User | null = null;
  @ViewChild("signaturePad") signaturePad?: ElementRef<HTMLCanvasElement>;

  profile: SignatureProfile = {
    displayName: "",
    signatureMode: "name",
    signatureName: "",
    signatureImage: "",
    signatureDrawing: "",
  };
  isDrawing = false;
  isSaving = false;
  message = "";

  private unsubscribe: Unsubscribe | null = null;

  get displayName(): string {
    return this.profile.displayName || this.user?.displayName || "";
  }

  get displayedName(): string {
    return this.displayName || "Non renseigné";
  }

  get email(): string {
    return this.user?.email || "Non renseigné";
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

    this.unsubscribe?.();
    this.unsubscribe = null;

    if (!this.user) {
      return;
    }

    this.unsubscribe = onSnapshot(doc(db, "users", this.user.uid), (snapshot) => {
      const data = snapshot.data() as SignatureProfile | undefined;
      this.profile = {
        displayName: data?.displayName || this.user?.displayName || "",
        signatureMode: data?.signatureMode || "name",
        signatureName: data?.signatureName || this.user?.displayName || this.user?.email || "",
        signatureImage: data?.signatureImage || "",
        signatureDrawing: data?.signatureDrawing || "",
      };
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }

  async saveProfile(): Promise<void> {
    if (!this.user) {
      return;
    }

    this.isSaving = true;
    this.message = "";

    try {
      const displayName = this.profile.displayName?.trim() || "";
      const signatureName = this.profile.signatureName?.trim() || displayName || this.user.displayName || this.user.email || "";

      if (displayName && displayName !== this.user.displayName) {
        await updateProfile(this.user, { displayName });
      }

    await setDoc(
      doc(db, "users", this.user.uid),
      {
        ...this.profile,
        displayName,
        email: this.user.email || "",
        signatureName,
      },
      { merge: true },
    );
      this.message = "Profil enregistré.";
    } catch (error) {
      this.message = "Impossible d'enregistrer le profil.";
      console.error(error);
    } finally {
      this.isSaving = false;
    }
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
      this.profile.signatureImage = String(reader.result || "");
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
    context.strokeStyle = "#111827";
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

  private pointerPosition(event: MouseEvent | TouchEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const point = event instanceof MouseEvent ? event : event.touches[0];

    return {
      x: ((point.clientX - rect.left) / rect.width) * canvas.width,
      y: ((point.clientY - rect.top) / rect.height) * canvas.height,
    };
  }
}
