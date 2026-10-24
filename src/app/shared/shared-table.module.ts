import { Directive, NgModule, OnInit, inject } from "@angular/core";
import { Table, TableModule } from "primeng/table";

/**
 * Applies the application's common table contract to the PrimeNG component.
 * Keeping PrimeNG as the host preserves its template context, sorting, filters
 * and row actions without introducing a second table implementation.
 */
@Directive({
  selector: "p-table",
  standalone: true,
  host: { class: "app-data-table" },
})
export class SharedTableDirective implements OnInit {
  private readonly table = inject(Table, { self: true });

  /** Every list remains paginated, including short lists and modal tables. */
  ngOnInit(): void {
    this.table.paginator = true;
    this.table.rows = this.table.rows || 25;
    this.table.rowsPerPageOptions = this.table.rowsPerPageOptions || [25, 50, 100];
    this.table.alwaysShowPaginator = true;
    // Render the overlay outside the scroll container so opening it cannot
    // enlarge the table or clip the page-size choices, including in modals.
    this.table.paginatorDropdownAppendTo = "body";
  }
}

/** Import this module instead of TableModule to share the table's UI contract. */
@NgModule({
  imports: [TableModule, SharedTableDirective],
  exports: [TableModule, SharedTableDirective],
})
export class SharedTableModule {}
