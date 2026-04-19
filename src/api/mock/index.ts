import type {
  AppApi,
  AppCommandResult,
  CreateSeasonInput,
  HistoryData,
  HistoryHardResetInput,
  HistoryPreviewInput,
  HistoryPreviewState,
  HistoryQuery,
  HistoryRollbackInput,
  HistoryRow,
  ImportCategory,
  ImportDraftInput,
  ImportDraftState,
  ImportReviewCorrectionInput,
  ImportReviewDecision,
  ImportReviewItem,
  SeasonCommand,
  SeasonListItem,
  StandingsData,
  StandingsRowIdentity,
  StandingsRowIdentityCorrectionInput,
} from "../contracts/index.ts";

type MockSeasonRecord = SeasonListItem & {
  standings: StandingsData;
};

type ImportDraftRecord = ImportDraftState;

type HistoryRecord = {
  seasonId: string;
  seasonLabel: string;
  raceEventId: string;
  raceLabel: string;
  categoryLabel: string;
  raceDateLabel: string;
  rows: HistoryRow[];
};

function isoDate(value: string): string {
  return new Date(value).toISOString();
}

function buildStandings(
  seasonId: string,
  seasonLabel: string,
  lastUpdatedAt: string,
  totalRuns: number,
): StandingsData {
  const categories = [
    {
      key: "half_hour:women",
      label: "30 Minuten Damen",
      description: "Kompakter Sprintvergleich fuer die Frauenwertung.",
      participantCount: 8,
      importedRuns: Math.max(1, totalRuns - 1),
    },
    {
      key: "hour:women",
      label: "60 Minuten Damen",
      description: "Vollstaendige Saisonwertung der Frauenkategorie.",
      participantCount: 9,
      importedRuns: totalRuns,
    },
    {
      key: "half_hour:men",
      label: "30 Minuten Herren",
      description: "Kompakter Sprintvergleich fuer die Herrenwertung.",
      participantCount: 10,
      importedRuns: Math.max(1, totalRuns - 1),
    },
    {
      key: "hour:men",
      label: "60 Minuten Herren",
      description: "Vollstaendige Saisonwertung der Herrenkategorie.",
      participantCount: 12,
      importedRuns: totalRuns,
    },
    {
      key: "half_hour:couples_women",
      label: "30 Minuten Paare Damen",
      description: "Noch keine Paardaten vorhanden.",
      participantCount: 0,
      importedRuns: 0,
    },
    {
      key: "hour:couples_women",
      label: "60 Minuten Paare Damen",
      description: "Noch keine Paardaten vorhanden.",
      participantCount: 0,
      importedRuns: 0,
    },
    {
      key: "half_hour:couples_men",
      label: "30 Minuten Paare Herren",
      description: "Noch keine Paardaten vorhanden.",
      participantCount: 0,
      importedRuns: 0,
    },
    {
      key: "hour:couples_men",
      label: "60 Minuten Paare Herren",
      description: "Noch keine Paardaten vorhanden.",
      participantCount: 0,
      importedRuns: 0,
    },
    {
      key: "half_hour:couples_mixed",
      label: "30 Minuten Paare Mixed",
      description: "Noch keine Paardaten vorhanden.",
      participantCount: 0,
      importedRuns: 0,
    },
    {
      key: "hour:couples_mixed",
      label: "60 Minuten Paare Mixed",
      description: "Noch keine Paardaten vorhanden.",
      participantCount: 0,
      importedRuns: 0,
    },
  ];

  return {
    seasonId,
    summary: {
      seasonLabel,
      totalTeams: 18,
      totalParticipants: 37,
      totalRuns,
      lastUpdatedAt,
    },
    categories,
    rowsByCategory: {
      "half_hour:women": [
        {
          rank: 1,
          team: "Erika Musterfrau",
          club: "Greifswald Laufteam",
          points: 43,
          distanceKm: 18.211,
          races: 2,
          raceCells: [
            { distanceKm: 9.1, points: 22, countsTowardTotal: true },
            { distanceKm: 9.111, points: 21, countsTowardTotal: true },
          ],
        },
        {
          rank: 2, team: "Paula Kruse", club: "TSV Wolgast", points: 38, distanceKm: 17.012, races: 2,
          raceCells: [
            { distanceKm: 8.5, points: 19, countsTowardTotal: true },
            { distanceKm: 8.512, points: 19, countsTowardTotal: true },
          ],
        },
      ],
      "half_hour:men": [
        {
          rank: 1, team: "Max Mustermann", club: "HSG Triathlon", points: 44, distanceKm: 19.123, races: 2,
          raceCells: [
            { distanceKm: 9.6, points: 22, countsTowardTotal: true },
            { distanceKm: 9.523, points: 22, countsTowardTotal: true },
          ],
        },
        {
          rank: 2, team: "Lukas Meyer", club: "SV Anklam", points: 39, distanceKm: 18.678, races: 2,
          raceCells: [
            { distanceKm: 9.3, points: 20, countsTowardTotal: true },
            { distanceKm: 9.378, points: 19, countsTowardTotal: true },
          ],
        },
      ],
      "hour:men": [
        {
          rank: 1, team: "Max Mustermann", club: "HSG Triathlon", points: 75, distanceKm: 48.123, races: 3,
          raceCells: [
            { distanceKm: 16.0, points: 25, countsTowardTotal: true },
            { distanceKm: 16.1, points: 25, countsTowardTotal: true },
            { distanceKm: 16.023, points: 25, countsTowardTotal: true },
          ],
        },
        {
          rank: 2, team: "Lukas Meyer", club: "SV Anklam", points: 71, distanceKm: 45.678, races: 3,
          raceCells: [
            { distanceKm: 15.2, points: 24, countsTowardTotal: true },
            { distanceKm: 15.3, points: 23, countsTowardTotal: true },
            { distanceKm: 15.178, points: 24, countsTowardTotal: true },
          ],
        },
        {
          rank: 3, team: "Tim Becker", club: "Laufteam Nord", points: 66, distanceKm: 42.505, races: 3,
          raceCells: [
            { distanceKm: 14.1, points: 22, countsTowardTotal: true },
            { distanceKm: 14.2, points: 22, countsTowardTotal: true },
            { distanceKm: 14.205, points: 22, countsTowardTotal: true },
          ],
        },
      ],
      "hour:women": [
        {
          rank: 1,
          team: "Erika Musterfrau",
          club: "Greifswald Laufteam",
          points: 74,
          distanceKm: 44.211,
          races: 3,
          raceCells: [
            { distanceKm: 14.8, points: 25, countsTowardTotal: true },
            { distanceKm: 14.7, points: 25, countsTowardTotal: true },
            { distanceKm: 14.711, points: 24, countsTowardTotal: true },
          ],
        },
        {
          rank: 2, team: "Paula Kruse", club: "TSV Wolgast", points: 70, distanceKm: 43.012, races: 3,
          raceCells: [
            { distanceKm: 14.3, points: 24, countsTowardTotal: true },
            { distanceKm: 14.4, points: 23, countsTowardTotal: true },
            { distanceKm: 14.312, points: 23, countsTowardTotal: true },
          ],
        },
        {
          rank: 3,
          team: "Anna Holm",
          club: "HSG Triathlon",
          points: 65,
          distanceKm: 40.884,
          races: 2,
          note: "ein Lauf noch ausstehend",
          raceCells: [
            { distanceKm: 20.5, points: 33, countsTowardTotal: true },
            { distanceKm: 20.384, points: 32, countsTowardTotal: true },
            null,
          ],
        },
      ],
      "half_hour:mixed": [
        {
          rank: 1, team: "Lea + Tom", club: "Greifswald Laufteam", points: 39, distanceKm: 18.444, races: 2,
          raceCells: [
            { distanceKm: 9.2, points: 20, countsTowardTotal: true },
            { distanceKm: 9.244, points: 19, countsTowardTotal: true },
          ],
        },
        {
          rank: 2, team: "Nina + Paul", club: "HSG Triathlon", points: 35, distanceKm: 17.901, races: 2,
          raceCells: [
            { distanceKm: 9.0, points: 18, countsTowardTotal: true },
            { distanceKm: 8.901, points: 17, countsTowardTotal: true },
          ],
        },
      ],
    },
    importedRuns: [
      {
        raceLabel: "Lauf 1",
        categoryLabel: "60 Minuten Herren/Damen",
        dateLabel: "02.04.2026",
        sourceLabel: "lauf1-mw.xlsx",
        entries: 28,
      },
      {
        raceLabel: "Lauf 2",
        categoryLabel: "60 Minuten Herren/Damen",
        dateLabel: "09.04.2026",
        sourceLabel: "lauf2-mw.xlsx",
        entries: 30,
      },
      {
        raceLabel: "Lauf 3",
        categoryLabel: "30 Minuten Paare",
        dateLabel: "16.04.2026",
        sourceLabel: "lauf3-paare.xlsx",
        entries: 10,
      },
    ],
    exportActions: [
      {
        id: "export_pdf",
        label: "PDF exportieren",
        description: "Laufübersicht für den aktuellen Stand als PDF vorbereiten.",
        availability: "ready",
      },
      {
        id: "export_excel",
        label: "Excel exportieren",
        description: "Gesamtwertung als Excel-Datei bereitstellen.",
        availability: "ready",
      },
    ],
  };
}

function createInitialSeasons(): MockSeasonRecord[] {
  return [
    {
      seasonId: "season-2026",
      label: "Stundenlauf 2026",
      importedEvents: 3,
      lastModifiedAt: isoDate("2026-04-13T18:30:00"),
      isActive: true,
      standings: buildStandings("season-2026", "Stundenlauf 2026", isoDate("2026-04-13T18:30:00"), 3),
    },
    {
      seasonId: "season-2025",
      label: "Stundenlauf 2025",
      importedEvents: 6,
      lastModifiedAt: isoDate("2025-11-20T20:15:00"),
      isActive: false,
      standings: buildStandings("season-2025", "Stundenlauf 2025", isoDate("2025-11-20T20:15:00"), 6),
    },
    {
      seasonId: "season-2024",
      label: "Stundenlauf 2024",
      importedEvents: 5,
      lastModifiedAt: isoDate("2024-10-05T15:45:00"),
      isActive: false,
      standings: buildStandings("season-2024", "Stundenlauf 2024", isoDate("2024-10-05T15:45:00"), 5),
    },
  ];
}

function cloneSeason(record: MockSeasonRecord): MockSeasonRecord {
  return {
    ...record,
    standings: {
      ...record.standings,
      categories: record.standings.categories.map((category) => ({ ...category })),
      rowsByCategory: Object.fromEntries(
        Object.entries(record.standings.rowsByCategory).map(([key, rows]) => [
          key,
          rows.map((row) => ({ ...row })),
        ]),
      ),
      importedRuns: record.standings.importedRuns.map((entry) => ({ ...entry })),
      exportActions: record.standings.exportActions.map((action) => ({ ...action })),
      summary: { ...record.standings.summary },
    },
  };
}

function toSeasonSummary(record: MockSeasonRecord): SeasonListItem {
  return {
    seasonId: record.seasonId,
    label: record.label,
    importedEvents: record.importedEvents,
    lastModifiedAt: record.lastModifiedAt,
    isActive: record.isActive,
  };
}

function buildReviewItems(category: ImportCategory): ImportReviewItem[] {
  const base: ImportReviewItem[] = [
    {
      reviewId: "review-1",
      incoming: {
        displayName: "Katharina Moeller",
        yob: 1993,
        club: "",
        startNumber: 40,
        resultLabel: "7,041 km / 30 P",
      },
      candidates: [
        {
          candidateId: "team-102",
          displayName: "Katharina Moller",
          confidence: 0.95,
          isRecommended: true,
          fieldComparisons: [
            { fieldKey: "name", label: "Name", incomingValue: "Katharina Moeller", candidateValue: "Katharina Moller", isMatch: false },
            { fieldKey: "yob", label: "Jahrgang", incomingValue: "1993", candidateValue: "1993", isMatch: true },
            { fieldKey: "club", label: "Verein", incomingValue: "—", candidateValue: "HSG Uni Greifswald", isMatch: false },
          ],
        },
        {
          candidateId: "team-204",
          displayName: "Katrin Moeller",
          confidence: 0.72,
          isRecommended: false,
          fieldComparisons: [
            { fieldKey: "name", label: "Name", incomingValue: "Katharina Moeller", candidateValue: "Katrin Moeller", isMatch: false },
            { fieldKey: "yob", label: "Jahrgang", incomingValue: "1993", candidateValue: "1991", isMatch: false },
            { fieldKey: "club", label: "Verein", incomingValue: "—", candidateValue: "HSG Uni Greifswald", isMatch: false },
          ],
        },
      ],
    },
    {
      reviewId: "review-2",
      incoming: {
        displayName: "Max Mustermann",
        yob: 1989,
        club: "SV Nord",
        startNumber: 12,
        resultLabel: "15,223 km / 40 P",
      },
      candidates: [
        {
          candidateId: "team-001",
          displayName: "Max Mustermann",
          confidence: 0.99,
          isRecommended: true,
          fieldComparisons: [
            { fieldKey: "name", label: "Name", incomingValue: "Max Mustermann", candidateValue: "Max Mustermann", isMatch: true },
            { fieldKey: "yob", label: "Jahrgang", incomingValue: "1989", candidateValue: "1989", isMatch: true },
            { fieldKey: "club", label: "Verein", incomingValue: "SV Nord", candidateValue: "SV Nord", isMatch: true },
          ],
        },
      ],
    },
  ];

  if (category === "doubles") {
    return [
      {
        reviewId: "review-1",
        incoming: {
          displayName: "Lea + Tom",
          yob: 1992,
          club: "Greifswald Laufteam",
          startNumber: 7,
          resultLabel: "6,122 km / 24 P",
        },
        candidates: [
          {
            candidateId: "team-c-7",
            displayName: "Lea + Thom",
            confidence: 0.91,
            isRecommended: true,
            fieldComparisons: [
              { fieldKey: "name", label: "Name", incomingValue: "Lea + Tom", candidateValue: "Lea + Thom", isMatch: false },
              { fieldKey: "yob", label: "Jahrgang", incomingValue: "1992", candidateValue: "1992", isMatch: true },
              { fieldKey: "club", label: "Verein", incomingValue: "Greifswald Laufteam", candidateValue: "Greifswald Laufteam", isMatch: true },
            ],
          },
        ],
      },
      ...base.slice(1),
    ];
  }

  return base;
}

function buildDraftSummary(decisions: ImportReviewDecision[]): ImportDraftState["summary"] {
  let mergedEntries = 0;
  let newPersonsCreated = 0;
  let typoCorrections = 0;

  for (const decision of decisions) {
    if (decision.action === "create_new") {
      newPersonsCreated += 1;
      continue;
    }
    mergedEntries += 1;
    if (decision.action === "merge_with_typo_fix") {
      typoCorrections += 1;
    }
  }

  return {
    importedEntries: decisions.length,
    mergedEntries,
    newPersonsCreated,
    typoCorrections,
    infos: [],
    warnings: [],
  };
}

function cloneImportDraft(record: ImportDraftRecord): ImportDraftState {
  return {
    ...record,
    reviewItems: record.reviewItems.map((item) => ({
      ...item,
      incoming: { ...item.incoming },
      candidates: item.candidates.map((candidate) => ({
        ...candidate,
        fieldComparisons: candidate.fieldComparisons.map((comparison) => ({ ...comparison })),
      })),
    })),
    decisions: record.decisions.map((decision) => ({ ...decision })),
    summary: {
      ...record.summary,
      infos: [...record.summary.infos],
      warnings: [...record.summary.warnings],
    },
  };
}

function createHistoryRows(): HistoryRow[] {
  return [
    {
      seq: 101,
      recordedAt: isoDate("2026-04-01T19:03:00"),
      eventId: "evt-101",
      type: "import_batch.recorded",
      summary: "Importlauf 3 (Datei lauf3-mw.xlsx) angelegt.",
      scope: "batch",
      raceEventId: "race-2026-3-hour-men",
      importBatchId: "batch-2026-04-01-lauf3",
      groupKey: "batch-2026-04-01-lauf3",
      isEffectiveChange: true,
      actionability: {
        canPreviewRollbackAtomic: false,
        canPreviewRollbackGroup: true,
        canHardResetToHere: true,
      },
    },
    {
      seq: 102,
      recordedAt: isoDate("2026-04-01T19:03:08"),
      eventId: "evt-102",
      type: "race.registered",
      summary: "Lauf 3 (60 Minuten Herren) importiert.",
      scope: "race",
      raceEventId: "race-2026-3-hour-men",
      importBatchId: "batch-2026-04-01-lauf3",
      groupKey: "batch-2026-04-01-lauf3",
      isEffectiveChange: true,
      actionability: {
        canPreviewRollbackAtomic: true,
        canPreviewRollbackGroup: true,
        canHardResetToHere: true,
      },
    },
    {
      seq: 103,
      recordedAt: isoDate("2026-04-02T09:20:51"),
      eventId: "evt-103",
      type: "entry.corrected",
      summary: "Distanzkorrektur bei Startnr. 12 (+0,084 km).",
      scope: "race",
      raceEventId: "race-2026-3-hour-men",
      importBatchId: "batch-2026-04-01-lauf3",
      groupKey: "batch-2026-04-01-lauf3",
      isEffectiveChange: true,
      actionability: {
        canPreviewRollbackAtomic: true,
        canPreviewRollbackGroup: true,
        canHardResetToHere: true,
      },
    },
    {
      seq: 104,
      recordedAt: isoDate("2026-04-02T09:31:15"),
      eventId: "evt-104",
      type: "entry.reassigned",
      summary: "Startnr. 28 auf bestehendes Team umgebucht.",
      scope: "race",
      raceEventId: "race-2026-3-hour-men",
      importBatchId: "batch-2026-04-01-lauf3",
      groupKey: "batch-2026-04-01-lauf3",
      isEffectiveChange: true,
      actionability: {
        canPreviewRollbackAtomic: true,
        canPreviewRollbackGroup: true,
        canHardResetToHere: true,
      },
    },
    {
      seq: 105,
      recordedAt: isoDate("2026-04-05T10:17:03"),
      eventId: "evt-105",
      type: "race.metadata_corrected",
      summary: "Laufdatum auf 01.04.2026 korrigiert.",
      scope: "race",
      raceEventId: "race-2026-3-hour-men",
      importBatchId: "batch-2026-04-01-lauf3",
      groupKey: "batch-2026-04-01-lauf3",
      isEffectiveChange: true,
      actionability: {
        canPreviewRollbackAtomic: true,
        canPreviewRollbackGroup: true,
        canHardResetToHere: true,
      },
    },
    {
      seq: 106,
      recordedAt: isoDate("2026-04-07T12:02:10"),
      eventId: "evt-106",
      type: "race.rolled_back",
      summary: "Rollback für Lauf 3 aus Historie ausgelöst.",
      scope: "race",
      raceEventId: "race-2026-3-hour-men",
      importBatchId: "batch-2026-04-01-lauf3",
      groupKey: "batch-2026-04-01-lauf3",
      isEffectiveChange: false,
      actionability: {
        canPreviewRollbackAtomic: false,
        canPreviewRollbackGroup: false,
        canHardResetToHere: true,
      },
    },
    {
      seq: 107,
      recordedAt: isoDate("2026-04-07T12:02:11"),
      eventId: "evt-107",
      type: "import_batch.rolled_back",
      summary: "Importbatch lauf3-mw.xlsx wurde zurückgerollt.",
      scope: "batch",
      raceEventId: "race-2026-3-hour-men",
      importBatchId: "batch-2026-04-01-lauf3",
      groupKey: "batch-2026-04-01-lauf3",
      isEffectiveChange: false,
      actionability: {
        canPreviewRollbackAtomic: false,
        canPreviewRollbackGroup: false,
        canHardResetToHere: true,
      },
    },
  ];
}

function createInitialHistoryBySeason(): Map<string, HistoryRecord> {
  const season2026Rows = createHistoryRows();
  return new Map<string, HistoryRecord>([
    [
      "season-2026",
      {
        seasonId: "season-2026",
        seasonLabel: "Stundenlauf 2026",
        raceEventId: "race-2026-3-hour-men",
        raceLabel: "Lauf 3",
        categoryLabel: "60 Minuten Herren",
        raceDateLabel: "01.04.2026",
        rows: season2026Rows,
      },
    ],
  ]);
}

function cloneHistoryData(record: HistoryRecord, query?: HistoryQuery): HistoryData {
  const raceEventId = query?.raceEventId ?? record.raceEventId;
  const includeNonRace = Boolean(query?.includeNonRace);
  const rows = record.rows
    .filter((row) => includeNonRace || row.raceEventId === raceEventId)
    .map((row) => ({
      ...row,
      actionability: { ...row.actionability },
    }));
  return {
    seasonId: record.seasonId,
    seasonLabel: record.seasonLabel,
    raceContext: {
      raceEventId: record.raceEventId,
      raceLabel: record.raceLabel,
      categoryLabel: record.categoryLabel,
      raceDateLabel: record.raceDateLabel,
    },
    rows,
  };
}

function upsertImportedRun(record: MockSeasonRecord, fileName: string, category: ImportCategory, raceNumber: number) {
  const raceLabel = `Lauf ${raceNumber}`;
  const existing = record.standings.importedRuns.find((entry) => entry.raceLabel === raceLabel);
  const categoryLabel = category === "doubles" ? "30 Minuten Paare" : "60 Minuten Herren/Damen";
  const nextEntry = {
    raceLabel,
    categoryLabel,
    dateLabel: new Date().toLocaleDateString("de-DE"),
    sourceLabel: fileName,
    entries: 24,
  };
  if (existing) {
    Object.assign(existing, nextEntry);
  } else {
    record.standings.importedRuns.push(nextEntry);
  }

  record.importedEvents = Math.max(record.importedEvents, raceNumber);
  record.lastModifiedAt = new Date().toISOString();
  record.standings.summary.totalRuns = Math.max(record.standings.summary.totalRuns, raceNumber);
  record.standings.summary.lastUpdatedAt = record.lastModifiedAt;

  record.standings.categories = record.standings.categories.map((cat) => {
    const isCouple = cat.label.includes("Paare");
    if ((category === "doubles" && isCouple) || (category === "singles" && !isCouple)) {
      return { ...cat, importedRuns: Math.max(cat.importedRuns, raceNumber) };
    }
    return cat;
  });
}

class MockAppApi implements AppApi {
  private seasons: MockSeasonRecord[] = createInitialSeasons();

  private unresolvedReviews = 2;
  private importDrafts = new Map<string, ImportDraftRecord>();
  private historyBySeason = createInitialHistoryBySeason();

  getShellData() {
    const active = this.seasons.find((season) => season.isActive) ?? null;
    return Promise.resolve({
      selectedSeasonId: active?.seasonId ?? null,
      selectedSeasonLabel: active?.label ?? null,
      unresolvedReviews: this.unresolvedReviews,
      availableSeasons: this.seasons.map((season) => ({
        seasonId: season.seasonId,
        label: season.label,
      })),
    });
  }

  listSeasons() {
    return Promise.resolve(this.seasons.map((season) => toSeasonSummary(cloneSeason(season))));
  }

  createSeason(input: CreateSeasonInput) {
    const label = input.label.trim();
    if (!label) {
      throw new Error("Bitte einen Saisonnamen eingeben.");
    }

    const seasonId = `season-${Math.random().toString(36).slice(2, 8)}`;
    const lastModifiedAt = new Date().toISOString();
    this.seasons = this.seasons.map((season) => ({
      ...season,
      isActive: false,
    }));

    const created: MockSeasonRecord = {
      seasonId,
      label,
      importedEvents: 0,
      lastModifiedAt,
      isActive: true,
      standings: {
        seasonId,
        summary: {
          seasonLabel: label,
          totalTeams: 0,
          totalParticipants: 0,
          totalRuns: 0,
          lastUpdatedAt: lastModifiedAt,
        },
        categories: [],
        rowsByCategory: {},
        importedRuns: [],
        exportActions: [
          {
            id: "export_pdf",
            label: "PDF exportieren",
            description: "Sobald Läufe importiert sind, steht der PDF-Export bereit.",
            availability: "planned",
          },
          {
            id: "export_excel",
            label: "Excel exportieren",
            description: "Sobald Läufe importiert sind, steht der Excel-Export bereit.",
            availability: "planned",
          },
        ],
      },
    };

    this.seasons = [created, ...this.seasons];
    return Promise.resolve(toSeasonSummary(cloneSeason(created)));
  }

  openSeason(seasonId: string) {
    const found = this.seasons.some((season) => season.seasonId === seasonId);
    if (!found) {
      throw new Error("Die ausgewählte Saison wurde nicht gefunden.");
    }
    this.seasons = this.seasons.map((season) => ({
      ...season,
      isActive: season.seasonId === seasonId,
    }));
    return Promise.resolve();
  }

  deleteSeason(seasonId: string) {
    const next = this.seasons.filter((season) => season.seasonId !== seasonId);
    if (next.length === this.seasons.length) {
      throw new Error("Die ausgewählte Saison wurde nicht gefunden.");
    }
    const hadActive = this.seasons.some((season) => season.seasonId === seasonId && season.isActive);
    this.seasons = next.map((season, index) => ({
      ...season,
      isActive: hadActive ? index === 0 : season.isActive,
    }));
    return Promise.resolve();
  }

  runSeasonCommand(command: SeasonCommand, seasonId?: string) {
    const season = seasonId
      ? this.seasons.find((entry) => entry.seasonId === seasonId) ?? null
      : this.seasons.find((entry) => entry.isActive) ?? null;

    if (command === "import_backup") {
      return Promise.resolve({
        severity: "info",
        message: season
          ? `Mock-Import für "${season.label}" vorbereitet. Die Live-Portabilität folgt mit TsAppApi.`
          : "Mock-Import vorbereitet. Die Live-Portabilität folgt mit TsAppApi.",
      } satisfies AppCommandResult);
    }

    return Promise.resolve({
      severity: "info",
      message: season
        ? `Mock-Export für "${season.label}" vorbereitet. Die echte Datei-Ausgabe folgt mit TsAppApi.`
        : "Mock-Export vorbereitet. Die echte Datei-Ausgabe folgt mit TsAppApi.",
    } satisfies AppCommandResult);
  }

  getStandings(seasonId: string) {
    const season = this.seasons.find((entry) => entry.seasonId === seasonId);
    if (!season) {
      throw new Error("Für die ausgewählte Saison liegen keine Wertungsdaten vor.");
    }
    return Promise.resolve(cloneSeason(season).standings);
  }

  runExportAction(
    seasonId: string,
    actionId: "export_pdf" | "export_excel",
    options?: { pdfLayoutPreset?: "default" | "compact" },
  ) {
    const season = this.seasons.find((entry) => entry.seasonId === seasonId);
    if (!season) {
      throw new Error("Bitte zuerst eine Saison auswählen.");
    }

    const label = actionId === "export_pdf" ? "PDF-Export" : "Excel-Export";
    const layoutSuffix =
      actionId === "export_pdf" ? ` (${options?.pdfLayoutPreset ?? "compact"})` : "";
    return Promise.resolve({
      severity: "success",
      message: `${label}${layoutSuffix} für "${season.label}" wurde im Mock-Modus ausgelöst.`,
    } satisfies AppCommandResult);
  }

  setStandingsRowExcluded(
    seasonId: string,
    input: { categoryKey: string; teamId: string; excluded: boolean },
  ) {
    const season = this.seasons.find((entry) => entry.seasonId === seasonId);
    if (!season) {
      throw new Error("Bitte zuerst eine Saison auswählen.");
    }
    const rows = season.standings.rowsByCategory[input.categoryKey];
    if (!rows) {
      throw new Error("Die ausgewählte Kategorie wurde nicht gefunden.");
    }
    const row = rows.find((entry) => (entry.teamId ?? entry.team) === input.teamId);
    if (!row) {
      throw new Error("Der gewählte Wertungseintrag wurde nicht gefunden.");
    }
    row.excluded = input.excluded;
    let eligibleRank = 0;
    for (const candidate of rows) {
      if (candidate.excluded) {
        candidate.rank = null;
        continue;
      }
      eligibleRank += 1;
      candidate.rank = eligibleRank;
    }
    return Promise.resolve();
  }

  getStandingsRowIdentity(
    seasonId: string,
    input: { categoryKey: string; teamId: string },
  ): Promise<StandingsRowIdentity> {
    const season = this.seasons.find((entry) => entry.seasonId === seasonId);
    if (!season) {
      return Promise.reject(new Error("Bitte zuerst eine Saison auswählen."));
    }
    const rows = season.standings.rowsByCategory[input.categoryKey] ?? [];
    const row = rows.find((entry) => (entry.teamId ?? entry.team) === input.teamId);
    if (!row) {
      return Promise.reject(new Error("Der gewählte Wertungseintrag wurde nicht gefunden."));
    }
    const teamName = row.team;
    const isCouple = teamName.includes(" + ");
    if (isCouple) {
      const [nameA = teamName, nameB = ""] = teamName.split(" + ");
      return Promise.resolve({
        teamId: input.teamId,
        teamKind: "couple",
        members: [
          { personId: `mock-person-a-${input.teamId}`, name: nameA, yob: 1990, club: row.club },
          { personId: `mock-person-b-${input.teamId}`, name: nameB, yob: 1991, club: row.club },
        ],
      });
    }
    return Promise.resolve({
      teamId: input.teamId,
      teamKind: "solo",
      members: [
        { personId: `mock-person-${input.teamId}`, name: teamName, yob: 1990, club: row.club },
      ],
    });
  }

  correctStandingsRowIdentity(
    seasonId: string,
    input: StandingsRowIdentityCorrectionInput,
  ): Promise<AppCommandResult> {
    const season = this.seasons.find((entry) => entry.seasonId === seasonId);
    if (!season) {
      return Promise.reject(new Error("Bitte zuerst eine Saison auswählen."));
    }
    const newName =
      input.members.length === 2
        ? `${input.members[0]?.name ?? ""} + ${input.members[1]?.name ?? ""}`
        : (input.members[0]?.name ?? "");
    const newClub = input.members[0]?.club ?? "";
    for (const rows of Object.values(season.standings.rowsByCategory)) {
      for (const row of rows) {
        if ((row.teamId ?? row.team) === input.teamId) {
          row.team = newName;
          row.club = newClub;
        }
      }
    }
    return Promise.resolve({ severity: "success", message: "Teilnehmerdaten gespeichert." });
  }

  createImportDraft(input: ImportDraftInput) {
    const season = this.seasons.find((entry) => entry.seasonId === input.seasonId);
    if (!season) {
      throw new Error("Bitte zuerst eine Saison auswählen.");
    }

    const fileName = input.fileName.trim();
    if (!fileName) {
      throw new Error("Bitte eine Datei auswählen.");
    }
    if (!Number.isInteger(input.raceNumber) || input.raceNumber < 1) {
      throw new Error("Bitte eine gültige Laufnummer wählen.");
    }

    const reviewItems = buildReviewItems(input.category);
    const decisions: ImportReviewDecision[] = reviewItems.map((item) => ({
      reviewId: item.reviewId,
      candidateId: item.candidates[0]?.candidateId ?? null,
      action: item.candidates.length > 0 ? "merge" : "create_new",
    }));
    const draftId = `import-draft-${Math.random().toString(36).slice(2, 10)}`;
    const draft: ImportDraftRecord = {
      draftId,
      seasonId: input.seasonId,
      fileName,
      category: input.category,
      raceNumber: input.raceNumber,
      step: "review_matches",
      reviewItems,
      decisions,
      summary: buildDraftSummary(decisions),
    };
    this.importDrafts.set(draftId, draft);
    return Promise.resolve(cloneImportDraft(draft));
  }

  getImportDraft(draftId: string) {
    const draft = this.importDrafts.get(draftId);
    if (!draft) {
      throw new Error("Der Import-Entwurf wurde nicht gefunden.");
    }
    return Promise.resolve(cloneImportDraft(draft));
  }

  setImportReviewDecision(draftId: string, decision: ImportReviewDecision) {
    const draft = this.importDrafts.get(draftId);
    if (!draft) {
      throw new Error("Der Import-Entwurf wurde nicht gefunden.");
    }
    const hasReview = draft.reviewItems.some((item) => item.reviewId === decision.reviewId);
    if (!hasReview) {
      throw new Error("Die ausgewählte Prüfung wurde nicht gefunden.");
    }

    const current = draft.decisions.filter((entry) => entry.reviewId !== decision.reviewId);
    current.push({ ...decision });
    current.sort((a, b) => a.reviewId.localeCompare(b.reviewId));
    draft.decisions = current;
    draft.summary = buildDraftSummary(draft.decisions);

    return Promise.resolve(cloneImportDraft(draft));
  }

  applyImportReviewCorrection(draftId: string, input: ImportReviewCorrectionInput) {
    const draft = this.importDrafts.get(draftId);
    if (!draft) {
      throw new Error("Der Import-Entwurf wurde nicht gefunden.");
    }
    const hasReview = draft.reviewItems.some((item) => item.reviewId === input.reviewId);
    if (!hasReview) {
      throw new Error("Die ausgewählte Prüfung wurde nicht gefunden.");
    }
    const next: ImportReviewDecision = {
      reviewId: input.reviewId,
      candidateId: input.candidateId,
      action: "merge_with_typo_fix",
    };
    const current = draft.decisions.filter((entry) => entry.reviewId !== input.reviewId);
    current.push(next);
    current.sort((a, b) => a.reviewId.localeCompare(b.reviewId));
    draft.decisions = current;
    draft.summary = buildDraftSummary(draft.decisions);
    return Promise.resolve(cloneImportDraft(draft));
  }

  finalizeImportDraft(draftId: string) {
    const draft = this.importDrafts.get(draftId);
    if (!draft) {
      throw new Error("Der Import-Entwurf wurde nicht gefunden.");
    }
    const allResolved = draft.reviewItems.every((item) =>
      draft.decisions.some((decision) => decision.reviewId === item.reviewId),
    );
    if (!allResolved) {
      throw new Error("Bitte erst alle offenen Zuordnungen abschließen.");
    }

    const season = this.seasons.find((entry) => entry.seasonId === draft.seasonId);
    if (!season) {
      throw new Error("Die Saison für den Import wurde nicht gefunden.");
    }

    upsertImportedRun(season, draft.fileName, draft.category, draft.raceNumber);
    this.unresolvedReviews = Math.max(0, this.unresolvedReviews - draft.reviewItems.length);
    this.importDrafts.delete(draftId);

    return Promise.resolve({
      severity: "success",
      message: `Import erfolgreich abgeschlossen: ${draft.fileName} (${draft.summary.importedEntries} Einträge).`,
    } satisfies AppCommandResult);
  }

  getHistory(seasonId: string, query?: HistoryQuery) {
    const record = this.historyBySeason.get(seasonId);
    if (!record) {
      const season = this.seasons.find((entry) => entry.seasonId === seasonId);
      if (!season) {
        throw new Error("Die ausgewaehlte Saison wurde nicht gefunden.");
      }
      return Promise.resolve({
        seasonId,
        seasonLabel: season.label,
        raceContext: null,
        rows: [],
      } satisfies HistoryData);
    }
    return Promise.resolve(cloneHistoryData(record, query));
  }

  previewHistoryState(seasonId: string, input: HistoryPreviewInput) {
    const record = this.historyBySeason.get(seasonId);
    if (!record) {
      throw new Error("Für diese Saison liegt keine Historie vor.");
    }
    const anchor = record.rows.find((row) => row.seq === input.anchorSeq);
    if (!anchor) {
      throw new Error("Der ausgewaehlte Verlaufspunkt ist nicht mehr vorhanden.");
    }
    return Promise.resolve({
      anchorSeq: anchor.seq,
      isFrozen: true,
      derivedStateLabel: `Historischer Stand bis seq ${anchor.seq}`,
      blockedReason: "Vorschau aktiv: weitere Aenderungen sind voruebergehend gesperrt.",
    } satisfies HistoryPreviewState);
  }

  rollbackHistory(seasonId: string, input: HistoryRollbackInput) {
    const record = this.historyBySeason.get(seasonId);
    if (!record) {
      throw new Error("Für diese Saison liegt keine Historie vor.");
    }
    const anchor = record.rows.find((row) => row.seq === input.anchorSeq);
    if (!anchor) {
      throw new Error("Der ausgewaehlte Verlaufspunkt wurde nicht gefunden.");
    }

    const latestSeq = record.rows.reduce((max, row) => Math.max(max, row.seq), 0);
    const stamp = new Date().toISOString();
    if (input.mode === "atomic") {
      record.rows.push({
        seq: latestSeq + 1,
        recordedAt: stamp,
        eventId: `evt-${latestSeq + 1}`,
        type: "race.rolled_back",
        summary: `Atomic rollback ab seq ${anchor.seq} ausgeführt (${input.reason}).`,
        scope: "race",
        raceEventId: input.raceEventId ?? anchor.raceEventId,
        importBatchId: anchor.importBatchId,
        groupKey: anchor.groupKey,
        isEffectiveChange: false,
        actionability: {
          canPreviewRollbackAtomic: false,
          canPreviewRollbackGroup: false,
          canHardResetToHere: true,
        },
      });
      return Promise.resolve({
        severity: "success",
        message: `Rollback für Laufkontext ab seq ${anchor.seq} wurde markiert.`,
      } satisfies AppCommandResult);
    }

    record.rows.push({
      seq: latestSeq + 1,
      recordedAt: stamp,
      eventId: `evt-${latestSeq + 1}`,
      type: "race.rolled_back",
      summary: `Gruppierter rollback (Importbatch ${input.importBatchId ?? anchor.importBatchId ?? "unbekannt"}) ausgeführt.`,
      scope: "race",
      raceEventId: input.raceEventId ?? anchor.raceEventId,
      importBatchId: input.importBatchId ?? anchor.importBatchId,
      groupKey: input.importBatchId ?? anchor.groupKey,
      isEffectiveChange: false,
      actionability: {
        canPreviewRollbackAtomic: false,
        canPreviewRollbackGroup: false,
        canHardResetToHere: true,
      },
    });
    record.rows.push({
      seq: latestSeq + 2,
      recordedAt: stamp,
      eventId: `evt-${latestSeq + 2}`,
      type: "import_batch.rolled_back",
      summary: `Importbatch-Rollback protokolliert (${input.reason}).`,
      scope: "batch",
      raceEventId: input.raceEventId ?? anchor.raceEventId,
      importBatchId: input.importBatchId ?? anchor.importBatchId,
      groupKey: input.importBatchId ?? anchor.groupKey,
      isEffectiveChange: false,
      actionability: {
        canPreviewRollbackAtomic: false,
        canPreviewRollbackGroup: false,
        canHardResetToHere: true,
      },
    });

    return Promise.resolve({
      severity: "success",
      message: `Gruppen-Rollback für Importbatch ab seq ${anchor.seq} wurde markiert.`,
    } satisfies AppCommandResult);
  }

  hardResetHistoryToSeq(seasonId: string, input: HistoryHardResetInput) {
    const record = this.historyBySeason.get(seasonId);
    if (!record) {
      throw new Error("Für diese Saison liegt keine Historie vor.");
    }
    const anchorIdx = record.rows.findIndex((row) => row.seq === input.anchorSeq);
    if (anchorIdx === -1) {
      throw new Error("Der ausgewaehlte Verlaufspunkt wurde nicht gefunden.");
    }
    record.rows = record.rows.slice(0, anchorIdx + 1);
    return Promise.resolve({
      severity: "warn",
      message: `Hard reset bis seq ${input.anchorSeq} ausgeführt. Nachfolgende Events wurden verworfen.`,
    } satisfies AppCommandResult);
  }
}

export function createMockAppApi(): AppApi {
  return new MockAppApi();
}
