import type { AppApi } from "../contracts/index.ts";

export const TS_APP_API_METHOD_MAP = {
  getShellData: [
    "SeasonRepository.listSeasons()",
    "projectState() for derived season metadata",
    "getReviewQueue() for unresolved review counts",
  ],
  listSeasons: ["SeasonRepository.listSeasons()", "projectState() for event counts and last activity"],
  createSeason: ["SeasonRepository.createSeason(label)"],
  openSeason: ["SeasonRepository.getEventLog(seasonId)", "projectState(seasonId, eventLog)"],
  deleteSeason: ["SeasonRepository.deleteSeason(seasonId)"],
  runSeasonCommand: ["exportSeason()", "importSeason()"],
  getStandings: ["SeasonRepository.getEventLog(seasonId)", "projectState()", "computeStandings()"],
  runExportAction: ["exportLaufuebersichtDualPdfs()", "exportGesamtwertungWorkbook()"],
  getHistory: ["SeasonRepository.getEventLog(seasonId)", "projectState()", "legacy timeline synthesis adapter"],
  previewHistoryState: ["SeasonRepository.getEventLog(seasonId)", "projectState(seasonId, eventsPrefix)"],
  rollbackHistory: ["appendEvents()", "race.rolled_back", "import_batch.rolled_back"],
  hardResetHistoryToSeq: ["SeasonRepository.getEventLog(seasonId)", "writeEventLog(seasonId, eventsPrefix)"],
} as const;

export function createTsAppApi(): AppApi {
  throw new Error(
    "TsAppApi is not wired yet. Phase 1 intentionally uses MockAppApi while keeping the method map explicit.",
  );
}
