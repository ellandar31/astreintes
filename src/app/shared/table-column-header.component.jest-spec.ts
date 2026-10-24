import { Component } from "@angular/core";
import { TestBed, fakeAsync, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { Table, TableModule } from "primeng/table";
import { TableColumnHeaderComponent } from "./table-column-header.component";
import { TableRowsPipe, tableDate } from "./table-rows.pipe";

@Component({ standalone: true, imports: [TableModule, TableColumnHeaderComponent, TableRowsPipe],
  template: `<p-table [value]="rows | tableRows" [filterDelay]="0">
    <ng-template pTemplate="header"><tr>
      <th pSortableColumn="name"><app-table-column-header field="name" label="Nom" /></th>
      <th pSortableColumn="hours"><app-table-column-header field="hours" label="Heures" kind="numeric" /></th>
      <th pSortableColumn="date"><app-table-column-header field="date" label="Date" kind="date" /></th>
      <th pSortableColumn="signed"><app-table-column-header field="signed" label="Visa" kind="boolean" /></th>
    </tr></ng-template>
    <ng-template pTemplate="body" let-row><tr><td>{{row.name}}</td><td>{{row.hours}}</td></tr></ng-template>
  </p-table>` })
class TableHost {
  readonly rows = Object.freeze([
    Object.freeze({ name: "Zeta", hours: 12, date: new Date(2026, 9, 9), signed: true }),
    Object.freeze({ name: "Alpha", hours: 2, date: new Date(2026, 9, 2), signed: false }),
  ]);
}

describe("Shared table controls", () => {
  it("sorts numbers and dates, combines typed filters and preserves source data", fakeAsync(() => {
    TestBed.configureTestingModule({ imports: [TableHost], providers: [provideNoopAnimations()] });
    const fixture = TestBed.createComponent(TableHost);
    fixture.detectChanges();
    const table = fixture.debugElement.query(By.directive(Table)).componentInstance as Table;
    const headers = fixture.nativeElement.querySelectorAll("th");
    headers[1].click(); fixture.detectChanges();
    expect(table.value.map(row => row.hours)).toEqual([2, 12]);
    headers[2].click(); fixture.detectChanges();
    expect(table.value.map(row => row.name)).toEqual(["Alpha", "Zeta"]);
    table.filter("al", "name", "contains"); tick(1);
    expect(table.filteredValue?.map(row => row.name)).toEqual(["Alpha"]);
    table.filter(false, "signed", "equals"); tick(1);
    expect(table.filteredValue?.map(row => row.name)).toEqual(["Alpha"]);
    table.filter(new Date(2026, 9, 9), "date", "dateIs"); tick(1);
    expect(table.filteredValue).toEqual([]);
    expect(fixture.componentInstance.rows.map(row => row.name)).toEqual(["Zeta", "Alpha"]);
    table.clear(); tick(1);
    expect(table.filteredValue).toBeNull();
  }));

  it("projects filter labels without modifying source objects and retains source identity", () => {
    const source = Object.freeze({ id: "1", name: "Agent" });
    const fields = { display: (row: typeof source) => `Direction - ${row.name}` };
    const view = new TableRowsPipe().transform([source], fields)[0] as typeof source & { display: string; tableSource: typeof source };
    expect(view.display).toBe("Direction - Agent");
    expect(view.tableSource).toBe(source);
    expect(source).toEqual({ id: "1", name: "Agent" });
  });

  it("normalizes SQL dates and displayed French ranges for calendar sorting", () => {
    expect(tableDate("sam 24/10/2026 18:00 - dim 25/10/2026 08:00")).toEqual(new Date(2026, 9, 24, 18));
    expect(tableDate("2026-10-24T18:00")).toEqual(new Date(2026, 9, 24, 18));
    expect(tableDate("not a date")).toBeNull();
    expect(tableDate(undefined)).toBeNull();
  });
});
