import type {
  AppApi,
  AppCommandResult,
  CreateSeasonInput,
  SeasonCommand,
  SeasonListItem,
  StandingsData,
} from "../contracts/index.ts";

type MockSeasonRecord = SeasonListItem & {
  standings: StandingsData;
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
        },
        { rank: 2, team: "Paula Kruse", club: "TSV Wolgast", points: 38, distanceKm: 17.012, races: 2 },
      ],
      "half_hour:men": [
        { rank: 1, team: "Max Mustermann", club: "HSG Triathlon", points: 44, distanceKm: 19.123, races: 2 },
        { rank: 2, team: "Lukas Meyer", club: "SV Anklam", points: 39, distanceKm: 18.678, races: 2 },
      ],
      "hour:men": [
        { rank: 1, team: "Max Mustermann", club: "HSG Triathlon", points: 75, distanceKm: 48.123, races: 3 },
        { rank: 2, team: "Lukas Meyer", club: "SV Anklam", points: 71, distanceKm: 45.678, races: 3 },
        { rank: 3, team: "Tim Becker", club: "Laufteam Nord", points: 66, distanceKm: 42.505, races: 3 },
      ],
      "hour:women": [
        {
          rank: 1,
          team: "Erika Musterfrau",
          club: "Greifswald Laufteam",
          points: 74,
          distanceKm: 44.211,
          races: 3,
        },
        { rank: 2, team: "Paula Kruse", club: "TSV Wolgast", points: 70, distanceKm: 43.012, races: 3 },
        {
          rank: 3,
          team: "Anna Holm",
          club: "HSG Triathlon",
          points: 65,
          distanceKm: 40.884,
          races: 2,
          note: "ein Lauf noch ausstehend",
        },
      ],
      "half_hour:mixed": [
        { rank: 1, team: "Lea + Tom", club: "Greifswald Laufteam", points: 39, distanceKm: 18.444, races: 2 },
        { rank: 2, team: "Nina + Paul", club: "HSG Triathlon", points: 35, distanceKm: 17.901, races: 2 },
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

class MockAppApi implements AppApi {
  private seasons: MockSeasonRecord[] = createInitialSeasons();

  private unresolvedReviews = 2;

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

  runExportAction(seasonId: string, actionId: "export_pdf" | "export_excel") {
    const season = this.seasons.find((entry) => entry.seasonId === seasonId);
    if (!season) {
      throw new Error("Bitte zuerst eine Saison auswählen.");
    }

    const label = actionId === "export_pdf" ? "PDF-Export" : "Excel-Export";
    return Promise.resolve({
      severity: "success",
      message: `${label} für "${season.label}" wurde im Mock-Modus ausgelöst.`,
    } satisfies AppCommandResult);
  }
}

export function createMockAppApi(): AppApi {
  return new MockAppApi();
}
