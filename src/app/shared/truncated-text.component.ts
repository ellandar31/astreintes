import { ChangeDetectorRef, Component, ElementRef, afterRenderEffect, inject, input, signal, viewChild } from "@angular/core";
import { TooltipModule } from "primeng/tooltip";

/** Keeps long labels within their field and exposes the full text only when clipped. */
@Component({
  selector: "app-truncated-text",
  standalone: true,
  imports: [TooltipModule],
  template: `<span #label [pTooltip]="text()" [tooltipDisabled]="!isTruncated()" tooltipPosition="top">{{ text() }}</span>`,
  styles: `
    :host { display: block; min-width: 0; max-width: 100%; width: 100%; }
    span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `,
})
export class TruncatedTextComponent {
  readonly text = input.required<string>();
  readonly isTruncated = signal(false);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly label = viewChild.required<ElementRef<HTMLElement>>("label");

  constructor() {
    afterRenderEffect((onCleanup) => {
      // Measure after rendering and on resize: character counts cannot predict clipping.
      this.text();
      const element = this.label().nativeElement;
      const measure = () => {
        this.isTruncated.set(element.scrollWidth > element.clientWidth);
        // PrimeNG projects selected labels into an OnPush view: update the tooltip
        // immediately after measuring, including ResizeObserver callbacks outside Angular.
        this.changeDetector.detectChanges();
      };
      measure();
      if (typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
  }
}
