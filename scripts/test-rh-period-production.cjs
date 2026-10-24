const assert = require('node:assert/strict');
const { build } = require('esbuild');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, dirname, resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

/** Exercise browser bundling: Jest's CommonJS loader hides ExcelJS export-shape differences. */
async function main() {
  const outputDirectory = mkdtempSync(join(tmpdir(), 'astreintes-rh-production-'));
  try {
    await build({
      entryPoints: ['src/app/pages/rh/export-libraries/rh-period-excel-export.lib.ts'],
      bundle: true,
      platform: 'browser',
      format: 'esm',
      minify: true,
      splitting: true,
      outdir: outputDirectory,
      outExtension: { '.js': '.mjs' },
    });
    const library = await import(pathToFileURL(join(outputDirectory, 'rh-period-excel-export.lib.mjs')).href);
    const bytes = await new library.RhPeriodExcelExportLibrary().buildWorkbook(
      { regular: [], exceptionalOnCall: [], exceptionalWork: [] },
      { startDate: '2026-10-01', endDate: '2026-10-31' },
      { publicHolidays: [], onCallCompensationRules: [], periodCompensationRules: [] },
    );
    const { Workbook } = require('exceljs');
    const workbook = new Workbook();
    await workbook.xlsx.load(Buffer.from(bytes));
    assert.equal(workbook.worksheets.length, 3);
    assert.ok(workbook.worksheets.every(sheet => sheet.rowCount === 1 && sheet.columnCount === 14));
    console.log('Production browser bundle: readable XLSX with three sheets.');
  } finally {
    if (dirname(resolve(outputDirectory)) === resolve(tmpdir())) rmSync(outputDirectory, { recursive: true, force: true });
  }
}

main().catch(error => {
  // Keep CI diagnostics concise; the failure originates in minified production chunks.
  console.error(error.message);
  process.exitCode = 1;
});
