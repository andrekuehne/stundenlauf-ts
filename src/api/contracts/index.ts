export type AppCommandSeverity = "info" | "success" | "warn" | "error";

export interface AppCommandResult {
  severity: AppCommandSeverity;
  message: string;
}

export interface ShellSeasonOption {
  seasonId: string;
  label: string;
}

export interface ShellData {
  selectedSeasonId: string | null;
  selectedSeasonLabel: string | null;
  unresolvedReviews: number;
  availableSeasons: ShellSeasonOption[];
}

export interface SeasonListItem {
  seasonId: string;
  label: string;
  importedEvents: number;
  lastModifiedAt: string;
  isActive: boolean;
}

export interface CreateSeasonInput {
  label: string;
}

export type SeasonCommand = "import_backup" | "export_backup";

export interface StandingsCategory {
  key: string;
  label: string;
  description: string;
  participantCount: number;
  importedRuns: number;
}

export interface StandingsSummary {
  seasonLabel: string;
  totalTeams: number;
  totalParticipants: number;
  totalRuns: number;
  lastUpdatedAt: string;
}

export interface StandingsRow {
  rank: number;
  team: string;
  club: string;
  points: number;
  distanceKm: number;
  races: number;
  note?: string;
}

export interface ImportedRunRow {
  raceLabel: string;
  categoryLabel: string;
  dateLabel: string;
  sourceLabel: string;
  entries: number;
}

export interface ExportActionDescriptor {
  id: "export_pdf" | "export_excel";
  label: string;
  description: string;
  availability: "ready" | "planned";
}

export interface StandingsData {
  seasonId: string;
  summary: StandingsSummary;
  categories: StandingsCategory[];
  rowsByCategory: Record<string, StandingsRow[]>;
  importedRuns: ImportedRunRow[];
  exportActions: ExportActionDescriptor[];
}

export interface AppApi {
  getShellData(): Promise<ShellData>;
  listSeasons(): Promise<SeasonListItem[]>;
  createSeason(input: CreateSeasonInput): Promise<SeasonListItem>;
  openSeason(seasonId: string): Promise<void>;
  deleteSeason(seasonId: string): Promise<void>;
  runSeasonCommand(command: SeasonCommand, seasonId?: string): Promise<AppCommandResult>;
  getStandings(seasonId: string): Promise<StandingsData>;
  runExportAction(seasonId: string, actionId: ExportActionDescriptor["id"]): Promise<AppCommandResult>;
}
