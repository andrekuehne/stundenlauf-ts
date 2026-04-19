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
  /** Effective `race_no` values for each per-race column (same order as row `raceCells`). */
  raceNos: readonly number[];
}

export interface StandingsSummary {
  seasonLabel: string;
  totalTeams: number;
  totalParticipants: number;
  totalRuns: number;
  lastUpdatedAt: string;
}

export interface StandingsRaceCell {
  distanceKm: number;
  points: number;
  countsTowardTotal: boolean;
}

export interface StandingsRow {
  rank: number | null;
  team: string;
  teamId?: string;
  club: string;
  yob?: number;
  yobPair?: string;
  points: number;
  distanceKm: number;
  races: number;
  raceCells: (StandingsRaceCell | null)[];
  note?: string;
  excluded?: boolean;
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

export type ImportCategory = "singles" | "doubles";
export type ImportWizardStep = "select_file" | "review_matches" | "summary";
export type ImportReviewAction = "merge" | "merge_with_typo_fix" | "create_new";

export interface ImportMatchingConfigInput {
  autoMin: number;
  reviewMin: number;
  autoMergeEnabled: boolean;
  perfectMatchAutoMerge: boolean;
  strictNormalizedAutoOnly: boolean;
}

export interface ImportDraftInput {
  seasonId: string;
  fileName: string;
  category: ImportCategory;
  raceNumber: number;
  matchingConfig?: ImportMatchingConfigInput;
}

export interface ImportIncomingRecord {
  displayName: string;
  yob: number;
  club: string | null;
  startNumber: number;
  resultLabel: string;
}

export interface ImportFieldComparison {
  fieldKey: "name" | "yob" | "club";
  label: string;
  incomingValue: string;
  candidateValue: string;
  isMatch: boolean;
}

export interface ImportReviewCandidate {
  candidateId: string;
  displayName: string;
  confidence: number;
  isRecommended: boolean;
  fieldComparisons: ImportFieldComparison[];
}

export interface ImportReviewItem {
  reviewId: string;
  incoming: ImportIncomingRecord;
  candidates: ImportReviewCandidate[];
}

export interface ImportReviewDecision {
  reviewId: string;
  candidateId: string | null;
  action: ImportReviewAction;
}

export interface ImportSingleIdentityCorrectionInput {
  type: "single";
  name: string;
  yob: number;
  club: string;
}

export interface ImportTeamMemberIdentityCorrectionInput {
  name: string;
  yob: number;
  club: string;
}

export interface ImportTeamIdentityCorrectionInput {
  type: "team";
  memberA: ImportTeamMemberIdentityCorrectionInput;
  memberB: ImportTeamMemberIdentityCorrectionInput;
}

export type ImportIdentityCorrectionInput =
  | ImportSingleIdentityCorrectionInput
  | ImportTeamIdentityCorrectionInput;

export interface ImportReviewCorrectionInput {
  reviewId: string;
  candidateId: string;
  correction: ImportIdentityCorrectionInput;
}

export interface ImportDraftSummary {
  importedEntries: number;
  mergedEntries: number;
  newPersonsCreated: number;
  typoCorrections: number;
  infos: string[];
  warnings: string[];
}

export interface ImportDraftState {
  draftId: string;
  seasonId: string;
  fileName: string;
  category: ImportCategory;
  raceNumber: number;
  step: ImportWizardStep;
  reviewItems: ImportReviewItem[];
  decisions: ImportReviewDecision[];
  summary: ImportDraftSummary;
}

export interface StandingsRowIdentityMember {
  personId: string;
  name: string;
  yob: number;
  club: string;
}

export interface StandingsRowIdentity {
  teamId: string;
  teamKind: "solo" | "couple";
  members: StandingsRowIdentityMember[];
}

export interface StandingsRowIdentityCorrectionInput {
  categoryKey: string;
  teamId: string;
  members: StandingsRowIdentityMember[];
}

export type HistoryScope = "race" | "batch" | "season";
export type HistoryRollbackMode = "atomic" | "grouped";

export interface HistoryQuery {
  raceEventId?: string;
  includeNonRace?: boolean;
}

export interface HistoryActionability {
  canPreviewRollbackAtomic: boolean;
  canPreviewRollbackGroup: boolean;
  canHardResetToHere: boolean;
}

export interface HistoryRow {
  seq: number;
  recordedAt: string;
  eventId: string;
  type: string;
  summary: string;
  scope: HistoryScope;
  raceEventId: string | null;
  importBatchId: string | null;
  groupKey: string | null;
  isEffectiveChange: boolean;
  actionability: HistoryActionability;
}

export interface HistoryRaceContext {
  raceEventId: string;
  raceLabel: string;
  categoryLabel: string;
  raceDateLabel: string;
}

export interface ImportBatchSummary {
  importBatchId: string;
  sourceFile: string;
  recordedAt: string;
  /** seq of the import_batch.recorded event */
  anchorSeq: number;
  state: "active" | "rolled_back";
  /** Human-readable label for the first race category in this batch (e.g. "60 Minuten Herren"), or null if none */
  categoryLabel: string | null;
}

export interface HistoryData {
  seasonId: string;
  seasonLabel: string;
  raceContext: HistoryRaceContext | null;
  rows: HistoryRow[];
  importBatches: ImportBatchSummary[];
}

export interface HistoryPreviewState {
  anchorSeq: number;
  isFrozen: boolean;
  derivedStateLabel: string;
  blockedReason: string;
}

export interface HistoryPreviewInput {
  anchorSeq: number;
}

export interface HistoryRollbackInput {
  mode: HistoryRollbackMode;
  anchorSeq: number;
  raceEventId?: string;
  importBatchId?: string;
  reason: string;
}

export interface HistoryHardResetInput {
  anchorSeq: number;
  reason: string;
  /**
   * "inclusive" (default): keep events up to and including anchorSeq.
   * "exclusive": drop anchorSeq and all subsequent events (used for "reset before this import").
   */
  truncateMode?: "inclusive" | "exclusive";
}

export interface AppApi {
  getShellData(): Promise<ShellData>;
  listSeasons(): Promise<SeasonListItem[]>;
  createSeason(input: CreateSeasonInput): Promise<SeasonListItem>;
  openSeason(seasonId: string): Promise<void>;
  deleteSeason(seasonId: string): Promise<void>;
  runSeasonCommand(command: SeasonCommand, seasonId?: string): Promise<AppCommandResult>;
  getStandings(seasonId: string): Promise<StandingsData>;
  runExportAction(
    seasonId: string,
    actionId: ExportActionDescriptor["id"],
    options?: { pdfLayoutPreset?: "default" | "compact" },
  ): Promise<AppCommandResult>;
  setStandingsRowExcluded(
    seasonId: string,
    input: { categoryKey: string; teamId: string; excluded: boolean },
  ): Promise<void>;
  getStandingsRowIdentity(
    seasonId: string,
    input: { categoryKey: string; teamId: string },
  ): Promise<StandingsRowIdentity>;
  correctStandingsRowIdentity(
    seasonId: string,
    input: StandingsRowIdentityCorrectionInput,
  ): Promise<AppCommandResult>;
  createImportDraft(input: ImportDraftInput): Promise<ImportDraftState>;
  getImportDraft(draftId: string): Promise<ImportDraftState>;
  setImportReviewDecision(draftId: string, decision: ImportReviewDecision): Promise<ImportDraftState>;
  applyImportReviewCorrection(draftId: string, input: ImportReviewCorrectionInput): Promise<ImportDraftState>;
  finalizeImportDraft(draftId: string): Promise<AppCommandResult>;
  getHistory(seasonId: string, query?: HistoryQuery): Promise<HistoryData>;
  previewHistoryState(seasonId: string, input: HistoryPreviewInput): Promise<HistoryPreviewState>;
  rollbackHistory(seasonId: string, input: HistoryRollbackInput): Promise<AppCommandResult>;
  hardResetHistoryToSeq(seasonId: string, input: HistoryHardResetInput): Promise<AppCommandResult>;
}
