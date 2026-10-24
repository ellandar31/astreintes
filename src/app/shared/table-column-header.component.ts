import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { TableModule } from "primeng/table";

/** Shared PrimeNG header; filtering and sorting remain local to the containing table. */
@Component({
  selector: "app-table-column-header",
  standalone: true,
  imports: [TableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span>{{ label }}</span><p-sortIcon [field]="field" />
    <p-columnFilter [field]="filterField || field" [type]="kind" display="menu"
      [matchMode]="kind === 'text' ? 'contains' : kind === 'date' ? 'dateIs' : 'equals'" />`,
  styles: [`:host { display: flex; align-items: center; gap: var(--app-space-xs); }`],
})
export class TableColumnHeaderComponent {
  @Input({ required: true }) label = "";
  @Input({ required: true }) field = "";
  @Input() filterField = "";
  @Input() kind: "text" | "numeric" | "date" | "boolean" = "text";
}
