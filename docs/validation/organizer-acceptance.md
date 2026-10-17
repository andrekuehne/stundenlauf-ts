# Organizer workbook acceptance

This is the manual completion checklist for WP-12 in the [dependency workplan](../workplans/2026-10-dependency-and-platform-refresh.md). Automated source checks and Linux LibreOffice results are recorded there with their independently reviewed revisions. Windows Excel acceptance remains with the user until the results below are supplied.

## Private inputs and reference scenario

The supplied files are `Ergebnisliste MW_1.xlsx` through `MW_5.xlsx` and `Ergebnisliste MW_Paare_1.xlsx` through `MW_Paare_5.xlsx`. They contain 348 singles rows and 303 couples rows across 50 race/category sections. The original workbooks stay ignored under `tests/data/xlsx/`.

No separate reference season or expected-results files are available. The optional acceptance suite reads source cells with ExcelJS independently of the SheetJS importer, checks imported identities and values, and independently recomputes the documented top-four ranking arithmetic. It also checks exports and a newly generated archive round-trip. The user excluded historical archive compatibility on 2026-10-17; it is not claimed tested.

The generated acceptance season uses 2026 as an explicit QA year, not a year inferred from the workbooks. It automatically links exact normalized matches and chooses **create new identity** for ambiguous review items. These choices exercise the workflow reproducibly; the resulting standings are a technical reference scenario, not organizer-approved final results. Before using that season operationally, review the private matching-case report and choose the intended identities.

## Run the automated checks locally

Use the pinned toolchain and installation from the README, then run:

```bash
pnpm exec vitest run tests/ingestion/local-excel-examples.test.ts tests/ingestion/local-organizer-acceptance.test.ts
```

The private suites skip when the organizer files are absent; ordinary CI retains the synthetic import/export and production browser gates. Do not publish fixture files, participant values, private outputs or parse dumps. The parse CLI prints names and clubs; redirect its output to a private location if needed and inspect its actual OK/error totals.

## Windows Excel check

Private acceptance files are supplied locally under `.local/organizer-acceptance/`, which is ignored by Git. The package contains the original inputs, the two app-generated XLSX files, the two dedicated result PDFs, a new season archive, a matching-case report and a file-hash manifest. Copy the private package to the Windows machine; it is not attached to the public pull request.

1. Record the Windows version and the Excel version/build from **File → Account → About Excel**.
2. Open `organizer-results.xlsx`. Check both `Gesamtwertung_Einzel` and `Gesamtwertung_Paare`: no repair or unreadable-content warning; readable names, umlauts, years, clubs, points and distances; intact merged headings and number formats. Compare representative cells with the original inputs, including a missing first member's club and a club containing a literal slash separator.
3. Open `organizer-kids.xlsx`. Check `Kids_Teilnahme`: readable names/years/clubs, correct run participation markers, full title and headers, and no repair warning. In Print Preview, confirm landscape orientation, all columns on one page across, readable text and repeated title/header rows on later pages. Paper size follows the application's printer defaults; the report may span several pages vertically.
4. Check the dedicated singles and couples PDFs for readable Unicode, complete headings and unclipped results. The wide result worksheets are intended for screen review; their unchanged default Excel print layout can split across horizontal pages. Use the dedicated PDFs for result printing rather than claiming the wide workbooks have an accepted print layout.
5. Report any differences or warnings using file/sheet/cell coordinates. Keep participant details and screenshots private.

Return this short result so the workplan can record actual application acceptance:

```text
Windows version:
Excel version/build:
Results workbook, both sheets (values/Unicode/merges/formats/warnings): PASS / findings
Kids workbook (values/participation/title): PASS / findings
Kids landscape print preview and repeated headers: PASS / findings
Dedicated result PDFs: PASS / findings
Wide results workbook print limitation / use of PDFs: accepted / findings
```

No manual pass is inferred from an automated test, a Linux LibreOffice run or delivery of this checklist. WP-12 remains pending until Windows results and the recorded print-layout limitation are accepted.
