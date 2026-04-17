import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  ImportDraftState,
  ImportReviewAction,
  ImportReviewItem,
  ImportedRunRow,
  ImportReviewCorrectionInput,
} from "@/api/contracts/index.ts";
import { rememberImportFile } from "@/api/import-file-registry.ts";
import { useAppApi } from "@/api/provider.tsx";
import { useAppShellContext } from "@/app/shell-context.ts";
import { STR } from "@/app/strings.ts";
import { ContentSplitLayout } from "@/components/layout/ContentSplitLayout.tsx";
import { PageHeader } from "@/components/layout/PageHeader.tsx";
import { ImportCandidateCard } from "@/features/import/ImportCandidateCard.tsx";
import { ImportSeasonOverview } from "@/features/import/ImportSeasonOverview.tsx";
import { ImportSummaryOverview } from "@/features/import/ImportSummaryOverview.tsx";
import { splitPairToken } from "@/features/import/split-pair-token.ts";
import { detectSourceType, parseRaceNo } from "@/ingestion/helpers.ts";
import { DEFAULT_AUTO_MIN, DEFAULT_REVIEW_MIN } from "@/matching/config.ts";
import { useStatusStore } from "@/stores/status.ts";

type StepKey = "select_file" | "review_matches" | "summary";
type MatchingMode = "strict" | "fuzzy_automatik" | "manuell";
type FuzzySubMode = "perfect" | "threshold";

type MatchingModeSettings = {
  autoThreshold: number;
  reviewThreshold: number;
};

const MATCHING_MODE_DEFAULTS: Record<MatchingMode, MatchingModeSettings> = {
  strict: { autoThreshold: DEFAULT_AUTO_MIN, reviewThreshold: DEFAULT_REVIEW_MIN },
  fuzzy_automatik: { autoThreshold: DEFAULT_AUTO_MIN, reviewThreshold: DEFAULT_REVIEW_MIN },
  manuell: { autoThreshold: DEFAULT_AUTO_MIN, reviewThreshold: DEFAULT_REVIEW_MIN },
};
const MATCHING_THRESHOLD_MIN = 0;
const MATCHING_THRESHOLD_MAX = 1;
const MATCHING_THRESHOLD_STEP = 0.01;

const FLOW_STEPS: Array<{ key: StepKey; label: string }> = [
  { key: "select_file", label: STR.views.import.flowStepSelect },
  { key: "review_matches", label: STR.views.import.flowStepReview },
  { key: "summary", label: STR.views.import.flowStepSummary },
];

function clampThreshold(value: number): number {
  return Math.min(MATCHING_THRESHOLD_MAX, Math.max(MATCHING_THRESHOLD_MIN, value));
}

function thresholdLabel(value: number): string {
  return value.toFixed(2);
}

function incomingYobParen(yob: number): string {
  return Number.isFinite(yob) && yob > 0 ? `(${yob})` : "(—)";
}

function incomingStartNrLabel(startNumber: number): string {
  return startNumber > 0 ? `Startnr. ${startNumber}` : "Startnr. —";
}

function parseYobToken(token: string, fallback: number): number {
  const trimmed = token.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed === "—") {
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
  }
  const match = /-?\d+/.exec(trimmed);
  const n = match ? Number.parseInt(match[0], 10) : Number.NaN;
  if (Number.isFinite(n) && n > 0 && n < 3000) {
    return n;
  }
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
}

function pairYobsFromReview(incomingYob: number, review: ImportReviewItem): [number, number] {
  const yobComp = review.candidates[0]?.fieldComparisons.find((comparison) => comparison.fieldKey === "yob");
  const raw = yobComp?.incomingValue.trim();
  if (!raw) {
    const shared = Number.isFinite(incomingYob) && incomingYob > 0 ? incomingYob : 0;
    return [shared, shared];
  }
  const [leftToken, rightToken] = splitPairToken(raw);
  const leftYob = parseYobToken(leftToken, incomingYob);
  const rightYob =
    rightToken === "—" ? (Number.isFinite(incomingYob) && incomingYob > 0 ? incomingYob : leftYob) : parseYobToken(rightToken, incomingYob);
  return [leftYob, rightYob];
}

function formatSoloIncomingSummaryLine(
  displayName: string,
  yob: number,
  startNumber: number,
  resultLabel: string,
): string {
  const name = displayName.trim() || "—";
  return `${name} ${incomingYobParen(yob)} | ${incomingStartNrLabel(startNumber)} | ${resultLabel.trim() || "—"}`;
}

function formatDoublesIncomingSummaryLine(
  leftName: string,
  rightName: string,
  yobLeft: number,
  yobRight: number,
  startNumber: number,
  resultLabel: string,
): string {
  const left = `${leftName.trim() || "—"} ${incomingYobParen(yobLeft)}`;
  const right = `${rightName.trim() || "—"} ${incomingYobParen(yobRight)}`;
  return `${left} / ${right} | ${incomingStartNrLabel(startNumber)} | ${resultLabel.trim() || "—"}`;
}

function effectiveAutoThresholdFromConfig(config: {
  autoMergeEnabled: boolean;
  perfectMatchAutoMerge: boolean;
  autoMin: number;
}): number {
  if (config.autoMergeEnabled) {
    return config.autoMin;
  }
  if (config.perfectMatchAutoMerge) {
    return 1;
  }
  return 1.01;
}

export function ImportPage() {
  const api = useAppApi();
  const { shellData, refreshShellData, setSidebarControls, setNavigationGuard } = useAppShellContext();
  const setStatus = useStatusStore((state) => state.setStatus);
  const [importedRuns, setImportedRuns] = useState<ImportedRunRow[]>([]);
  const [step, setStep] = useState<StepKey>("select_file");
  const [draft, setDraft] = useState<ImportDraftState | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<"singles" | "doubles">("singles");
  const [raceNumber, setRaceNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [matchingMode, setMatchingMode] = useState<MatchingMode>("fuzzy_automatik");
  const [fuzzySubMode, setFuzzySubMode] = useState<FuzzySubMode>("perfect");
  const [isMatchingSettingsOpen, setIsMatchingSettingsOpen] = useState(false);
  const [autoSelectTopReviewCandidate, setAutoSelectTopReviewCandidate] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [singleCorrection, setSingleCorrection] = useState({ name: "", yob: "", club: "" });
  const [teamCorrection, setTeamCorrection] = useState({
    memberA: { name: "", yob: "", club: "" },
    memberB: { name: "", yob: "", club: "" },
  });
  const [matchingModeSettings, setMatchingModeSettings] =
    useState<Record<MatchingMode, MatchingModeSettings>>(MATCHING_MODE_DEFAULTS);
  const [stagedDecisions, setStagedDecisions] = useState<
    Record<string, { action: ImportReviewAction; candidateId: string | null }>
  >({});
  const filePickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const seasonId = shellData.selectedSeasonId;
    if (!seasonId) {
      setImportedRuns([]);
      return;
    }
    const activeSeasonId = seasonId;

    let cancelled = false;
    async function loadImportedRuns() {
      try {
        const standings = await api.getStandings(activeSeasonId);
        if (!cancelled) {
          setImportedRuns(standings.importedRuns);
        }
      } catch {
        if (!cancelled) {
          setImportedRuns([]);
        }
      }
    }

    void loadImportedRuns();
    return () => {
      cancelled = true;
    };
  }, [api, shellData.selectedSeasonId]);

  useLayoutEffect(() => {
    setSidebarControls(null);
    return () => {
      setSidebarControls(null);
    };
  }, [setSidebarControls]);

  useEffect(() => {
    if (!draft) {
      setNavigationGuard(null);
      return;
    }
    setNavigationGuard({ message: STR.views.import.leaveInProgressConfirm });
    return () => {
      setNavigationGuard(null);
    };
  }, [draft, setNavigationGuard]);

  const canStartImport =
    Boolean(shellData.selectedSeasonId) && fileName.trim().length > 0 && Number.parseInt(raceNumber, 10) > 0;
  const activeReview = draft?.reviewItems[reviewIndex] ?? null;
  const totalReviews = draft?.reviewItems.length ?? 0;
  const currentDecision =
    activeReview && draft
      ? stagedDecisions[activeReview.reviewId]
        ? { reviewId: activeReview.reviewId, ...stagedDecisions[activeReview.reviewId] }
        : draft.decisions.find((decision) => decision.reviewId === activeReview.reviewId) ?? null
      : null;
  const selectedCorrectionCandidate =
    activeReview && currentDecision?.candidateId
      ? activeReview.candidates.find((candidate) => candidate.candidateId === currentDecision.candidateId) ?? null
      : null;
  const orderedCandidates = useMemo(() => {
    if (!activeReview) {
      return [];
    }

    return [...activeReview.candidates].sort((a, b) => {
      if (a.isRecommended !== b.isRecommended) {
        return a.isRecommended ? -1 : 1;
      }
      return b.confidence - a.confidence;
    });
  }, [activeReview]);
  const activeMatchingSettings = matchingModeSettings[matchingMode];
  const matchingConfigInput = useMemo(() => {
    if (matchingMode === "strict") {
      return {
        autoMin: activeMatchingSettings.autoThreshold,
        reviewMin: activeMatchingSettings.reviewThreshold,
        autoMergeEnabled: false,
        perfectMatchAutoMerge: false,
        strictNormalizedAutoOnly: true,
      };
    }
    if (matchingMode === "manuell") {
      return {
        autoMin: activeMatchingSettings.autoThreshold,
        reviewMin: activeMatchingSettings.reviewThreshold,
        autoMergeEnabled: false,
        perfectMatchAutoMerge: false,
        strictNormalizedAutoOnly: false,
      };
    }
    return {
      autoMin: activeMatchingSettings.autoThreshold,
      reviewMin: activeMatchingSettings.reviewThreshold,
      autoMergeEnabled: fuzzySubMode === "threshold",
      perfectMatchAutoMerge: true,
      strictNormalizedAutoOnly: false,
    };
  }, [activeMatchingSettings.autoThreshold, activeMatchingSettings.reviewThreshold, fuzzySubMode, matchingMode]);
  const effectiveAutoThreshold = effectiveAutoThresholdFromConfig(matchingConfigInput);
  const cappedReviewThreshold = Math.min(activeMatchingSettings.reviewThreshold, effectiveAutoThreshold);
  const visibleCandidates = useMemo(() => {
    if (matchingMode === "strict") {
      return orderedCandidates.filter(
        (candidate) =>
          candidate.confidence >= 1 ||
          candidate.fieldComparisons.every((comparison) => comparison.isMatch),
      );
    }
    if (matchingMode === "fuzzy_automatik") {
      return orderedCandidates.filter(
        (candidate) => candidate.confidence >= cappedReviewThreshold,
      );
    }
    return orderedCandidates;
  }, [cappedReviewThreshold, matchingMode, orderedCandidates]);
  const modeMayAutoMerge =
    matchingMode === "fuzzy_automatik" &&
    visibleCandidates.length > 0 &&
    (visibleCandidates[0]?.confidence ?? 0) >= effectiveAutoThreshold;
  const isDoublesReview = draft?.category === "doubles";

  const canAdvanceFromCurrentReview = useMemo(() => {
    if (!draft || !activeReview) {
      return true;
    }
    const staged = stagedDecisions[activeReview.reviewId];
    const fromDraft = draft.decisions.find((decision) => decision.reviewId === activeReview.reviewId);
    const decision = staged ?? fromDraft ?? null;
    if (!decision) {
      return false;
    }
    if (decision.action === "create_new") {
      return true;
    }
    return Boolean(decision.candidateId?.trim());
  }, [activeReview, draft, stagedDecisions]);

  const visibleSummary = useMemo(() => {
    if (!draft) {
      return null;
    }
    return draft.summary;
  }, [draft]);

  useEffect(() => {
    if (!autoSelectTopReviewCandidate || !activeReview || visibleCandidates.length === 0) {
      return;
    }

    const selectedCandidateId = currentDecision?.action === "merge" ? currentDecision.candidateId : null;
    const selectedCandidateVisible =
      selectedCandidateId != null &&
      visibleCandidates.some((candidate) => candidate.candidateId === selectedCandidateId);
    if (selectedCandidateVisible || currentDecision != null) {
      return;
    }

    const bestCandidate = visibleCandidates[0];
    if (!bestCandidate) {
      return;
    }
    stageReviewDecision("merge", bestCandidate.candidateId);
  }, [activeReview, autoSelectTopReviewCandidate, currentDecision, visibleCandidates]);

  async function startDraft() {
    if (!shellData.selectedSeasonId || !canStartImport) {
      return;
    }
    setBusy(true);
    try {
      const race = Number.parseInt(raceNumber, 10);
      if (selectedFile && selectedFile.name === fileName.trim()) {
        rememberImportFile(selectedFile);
      }
      const nextDraft = await api.createImportDraft({
        seasonId: shellData.selectedSeasonId,
        fileName: fileName.trim(),
        category,
        raceNumber: race,
        matchingConfig: matchingConfigInput,
      });
      setDraft(nextDraft);
      setStagedDecisions(
        Object.fromEntries(
          nextDraft.decisions.map((decision) => [
            decision.reviewId,
            { action: decision.action, candidateId: decision.candidateId },
          ]),
        ),
      );
      setReviewIndex(0);
      setStep(nextDraft.reviewItems.length === 0 ? "summary" : "review_matches");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : STR.views.import.importDraftFailed;
      setStatus({ severity: "error", source: "import", message });
    } finally {
      setBusy(false);
    }
  }

  function applyFileNameAutodetect(nextFileName: string) {
    const inferredCategory = detectSourceType(nextFileName) === "couples" ? "doubles" : "singles";
    const inferredRace = parseRaceNo(nextFileName);
    setCategory(inferredCategory);
    setRaceNumber(inferredRace > 0 ? String(inferredRace) : "");
  }

  function stageReviewDecision(action: ImportReviewAction, candidateId: string | null) {
    if (!draft || !activeReview) {
      return;
    }
    setStagedDecisions((current) => ({
      ...current,
      [activeReview.reviewId]: { action, candidateId },
    }));
  }

  function openCorrectionModal() {
    if (!activeReview || !currentDecision?.candidateId) {
      return;
    }
    const selectedCandidate = activeReview.candidates.find(
      (candidate) => candidate.candidateId === currentDecision.candidateId,
    );
    const nameIncoming = selectedCandidate?.fieldComparisons.find((item) => item.fieldKey === "name")?.incomingValue ?? activeReview.incoming.displayName;
    const yobIncoming = selectedCandidate?.fieldComparisons.find((item) => item.fieldKey === "yob")?.incomingValue ?? String(activeReview.incoming.yob);
    const clubIncoming = selectedCandidate?.fieldComparisons.find((item) => item.fieldKey === "club")?.incomingValue ?? (activeReview.incoming.club ?? "");
    const [nameA, nameB] = splitPairToken(nameIncoming);
    const [yobA, yobB] = splitPairToken(yobIncoming);
    const [clubA, clubB] = splitPairToken(clubIncoming);
    setSingleCorrection({
      name: nameIncoming,
      yob: String(parseYobToken(yobIncoming, activeReview.incoming.yob)),
      club: clubIncoming === "—" ? "" : clubIncoming,
    });
    setTeamCorrection({
      memberA: { name: nameA === "—" ? "" : nameA, yob: String(parseYobToken(yobA, activeReview.incoming.yob)), club: clubA === "—" ? "" : clubA },
      memberB: { name: nameB === "—" ? "" : nameB, yob: String(parseYobToken(yobB, activeReview.incoming.yob)), club: clubB === "—" ? "" : clubB },
    });
    setCorrectionError(null);
    setIsCorrectionModalOpen(true);
  }

  async function submitCorrection() {
    if (!draft || !activeReview || !currentDecision?.candidateId) {
      return;
    }
    const currentYear = new Date().getUTCFullYear();
    const parseInputYob = (raw: string): number => Number.parseInt(raw.trim(), 10);
    const isValidYob = (value: number) =>
      Number.isInteger(value) && value >= 1900 && value <= currentYear + 1;
    let payload: ImportReviewCorrectionInput;

    if (isDoublesReview) {
      const yobA = parseInputYob(teamCorrection.memberA.yob);
      const yobB = parseInputYob(teamCorrection.memberB.yob);
      if (
        teamCorrection.memberA.name.trim() === "" ||
        teamCorrection.memberB.name.trim() === "" ||
        !isValidYob(yobA) ||
        !isValidYob(yobB)
      ) {
        setCorrectionError("Name und Jahrgang sind für die Korrektur erforderlich.");
        return;
      }
      payload = {
        reviewId: activeReview.reviewId,
        candidateId: currentDecision.candidateId,
        correction: {
          type: "team",
          memberA: {
            name: teamCorrection.memberA.name.trim(),
            yob: yobA,
            club: teamCorrection.memberA.club.trim(),
          },
          memberB: {
            name: teamCorrection.memberB.name.trim(),
            yob: yobB,
            club: teamCorrection.memberB.club.trim(),
          },
        },
      };
    } else {
      const yob = parseInputYob(singleCorrection.yob);
      if (singleCorrection.name.trim() === "" || !isValidYob(yob)) {
        setCorrectionError("Name und Jahrgang sind für die Korrektur erforderlich.");
        return;
      }
      payload = {
        reviewId: activeReview.reviewId,
        candidateId: currentDecision.candidateId,
        correction: {
          type: "single",
          name: singleCorrection.name.trim(),
          yob,
          club: singleCorrection.club.trim(),
        },
      };
    }
    setBusy(true);
    try {
      const nextDraft = await api.applyImportReviewCorrection(draft.draftId, payload);
      setDraft(nextDraft);
      setStagedDecisions((current) => ({
        ...current,
        [activeReview.reviewId]: {
          action: "merge_with_typo_fix",
          candidateId: currentDecision.candidateId ?? null,
        },
      }));
      setIsCorrectionModalOpen(false);
      setCorrectionError(null);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Datenkorrektur fehlgeschlagen.";
      setCorrectionError(message);
    } finally {
      setBusy(false);
    }
  }

  async function finalizeImport() {
    if (!draft) {
      return;
    }
    setBusy(true);
    try {
      let nextDraft = draft;
      for (const reviewItem of draft.reviewItems) {
        const stagedDecision = stagedDecisions[reviewItem.reviewId];
        if (!stagedDecision) {
          continue;
        }
        const serverDecision = nextDraft.decisions.find((d) => d.reviewId === reviewItem.reviewId);
        const matchesServer =
          serverDecision != null &&
          serverDecision.action === stagedDecision.action &&
          serverDecision.candidateId === stagedDecision.candidateId;
        if (matchesServer) {
          continue;
        }
        nextDraft = await api.setImportReviewDecision(nextDraft.draftId, {
          reviewId: reviewItem.reviewId,
          action: stagedDecision.action,
          candidateId: stagedDecision.candidateId,
        });
      }
      const result = await api.finalizeImportDraft(nextDraft.draftId);
      await refreshShellData();
      try {
        const standings = await api.getStandings(nextDraft.seasonId);
        setImportedRuns(standings.importedRuns);
      } catch {
        setImportedRuns([]);
      }
      setStatus({ severity: result.severity, source: "import", message: result.message });
      setDraft(null);
      setStagedDecisions({});
      setRaceNumber("");
      setFileName("");
      setSelectedFile(null);
      setCategory("singles");
      setReviewIndex(0);
      setIsMatchingSettingsOpen(false);
      setStep("select_file");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : STR.views.import.importFailed;
      setStatus({ severity: "error", source: "import", message });
    } finally {
      setBusy(false);
    }
  }

  if (!shellData.selectedSeasonId) {
    return (
      <div className="page-stack">
        <PageHeader title={STR.views.import.title} description={STR.views.standings.noSeason} />
      </div>
    );
  }

  const flowSteps = (
    <ol className="import-flowbar" aria-label={STR.views.import.flowCurrent}>
      {FLOW_STEPS.map((entry, index) => {
        const currentIdx = FLOW_STEPS.findIndex((stepEntry) => stepEntry.key === step);
        const isDone = index < currentIdx;
        const isCurrent = index === currentIdx;
        return (
          <li
            key={entry.key}
            className={`import-flowbar__step ${isDone ? "is-done" : ""} ${isCurrent ? "is-current" : ""}`.trim()}
          >
            <span className="import-flowbar__label">
              {entry.label}
              {isDone ? <span className="import-flowbar__emoji"> ✅</span> : null}
              {isCurrent ? <span className="import-flowbar__emoji"> 👉</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className={`page-stack ${step === "review_matches" ? "page-stack--fill" : ""}`.trim()}>
      <section className={`import-workflow ${step === "review_matches" ? "import-workflow--fill" : ""}`.trim()}>
        {step === "select_file" ? (
          <ContentSplitLayout
            main={
              <article className="surface-card import-step import-step--select">
                {flowSteps}
                <p className="import-select-meta" data-testid="import-select-meta">
                  <span className="import-select-meta__eyebrow">
                    {STR.views.import.flowStepSelect.replace(/^\d+\.\s*/, "")}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span>{shellData.selectedSeasonLabel ?? STR.views.season.noActiveSeason}</span>
                </p>
                <div className="import-select-grid import-select-grid--with-overview">
                  <ImportSeasonOverview
                    importedRuns={importedRuns}
                    selectedCategory={category}
                    selectedRaceNumber={raceNumber}
                    disabled={busy}
                    onSelectRace={(nextCategory, nextRace) => {
                      setCategory(nextCategory);
                      setRaceNumber(String(nextRace));
                    }}
                  />
                  <div className="import-select-grid__divider" role="presentation" aria-hidden="true" />
                  <section className="import-select-form">
                    <div className="import-select-section__header">
                      <h2>{STR.views.import.selectFileTitle}</h2>
                      <p>{STR.views.import.selectFileHint}</p>
                    </div>
                    <div className="import-step__form">
                      <label className="import-controls__label">
                        <span>{STR.views.import.fileNameLabel}</span>
                        <div className="import-controls__file-row">
                          <input
                            value={fileName}
                            onChange={(event) => {
                              const nextFileName = event.target.value;
                              setFileName(nextFileName);
                              applyFileNameAutodetect(nextFileName);
                              setSelectedFile(null);
                            }}
                            placeholder={STR.views.import.filePlaceholder}
                            disabled={busy}
                          />
                          <input
                            ref={filePickerRef}
                            type="file"
                            accept=".xlsx"
                            className="import-controls__file-input"
                            onChange={(event) => {
                              const selectedFile = event.target.files?.[0];
                              if (selectedFile) {
                                setSelectedFile(selectedFile);
                                setFileName(selectedFile.name);
                                applyFileNameAutodetect(selectedFile.name);
                                rememberImportFile(selectedFile);
                              }
                            }}
                            disabled={busy}
                          />
                          <button
                            type="button"
                            className="button button--ghost import-controls__file-button"
                            onClick={() => {
                              filePickerRef.current?.click();
                            }}
                            disabled={busy}
                          >
                            📂 {STR.views.import.filePickButton}
                          </button>
                        </div>
                      </label>

                      {(() => {
                        const trimmedName = fileName.trim();
                        const detectedRace = Number.parseInt(raceNumber, 10);
                        const hasRace = Number.isFinite(detectedRace) && detectedRace > 0;
                        const categoryLabel =
                          category === "singles" ? STR.views.import.singles : STR.views.import.couples;
                        let statusClass = "import-select-status is-empty";
                        let statusContent: ReactNode = (
                          <span className="import-select-status__line">
                            {STR.views.import.selectionStatusNoFile}
                          </span>
                        );
                        if (trimmedName.length > 0 && hasRace) {
                          statusClass = "import-select-status is-detected";
                          statusContent = (
                            <>
                              <span className="import-select-status__line">
                                <span className="import-select-status__icon" aria-hidden="true">
                                  ✅
                                </span>
                                {STR.views.import.selectionStatusDetected(categoryLabel, detectedRace)}
                              </span>
                              <small className="import-select-status__sub">
                                {STR.views.import.selectionStatusDetectedSub}
                              </small>
                            </>
                          );
                        } else if (trimmedName.length > 0 && !hasRace) {
                          statusClass = "import-select-status is-needs-pick";
                          statusContent = (
                            <>
                              <span className="import-select-status__line">
                                <span className="import-select-status__icon" aria-hidden="true">
                                  ⚠️
                                </span>
                                {STR.views.import.selectionStatusRaceMissing(categoryLabel)}
                              </span>
                              <small className="import-select-status__sub">
                                {STR.views.import.selectionStatusRaceMissingSub}
                              </small>
                            </>
                          );
                        }
                        return (
                          <div className={statusClass} role="status" aria-live="polite">
                            {statusContent}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="import-step__actions">
                      <button
                        type="button"
                        className="button button--primary"
                        onClick={() => {
                          void startDraft();
                        }}
                        disabled={!canStartImport || busy}
                      >
                        {STR.views.import.stepNextToReview}
                      </button>
                    </div>
                  </section>
                </div>
              </article>
            }
          />
        ) : null}

        {step === "review_matches" && draft ? (
          <ContentSplitLayout
            fillHeight
            stickySide
            main={
              <article className="surface-card import-step import-step--fill">
                {flowSteps}
                <div className="surface-card__header import-review__toolbar">
                  <div className="import-review__toolbar-left">
                    <button
                      type="button"
                      className="button button--ghost import-review__action"
                      onClick={() => {
                        setStep("select_file");
                      }}
                      disabled={busy}
                    >
                      <span className="import-review__action-icon" aria-hidden="true">↩️</span>
                      {STR.views.import.stepBackToSelection}
                    </button>
                    <button
                      type="button"
                      className="button import-review__action"
                      onClick={() => {
                        setIsMatchingSettingsOpen(true);
                      }}
                      disabled={busy}
                    >
                      <span className="import-review__action-icon" aria-hidden="true">⚙️</span>
                      {STR.views.import.matchingSettings}
                    </button>
                  </div>
                  <div className="import-review__toolbar-right">
                    <button
                      type="button"
                      className="button button--ghost import-review__action"
                      onClick={() => {
                        setReviewIndex((current) => Math.max(0, current - 1));
                      }}
                      disabled={reviewIndex === 0 || busy}
                    >
                      <span className="import-review__action-icon" aria-hidden="true">⬅️</span>
                      {STR.views.import.reviewBackEntry}
                    </button>
                    <button
                      type="button"
                      className="button import-review__action import-review__action--correct"
                      disabled={!currentDecision?.candidateId || busy}
                      onClick={() => {
                        openCorrectionModal();
                      }}
                    >
                      {STR.views.import.fixData}
                    </button>
                    <button
                      type="button"
                      className={`button import-review__next-button import-review__action ${reviewIndex >= totalReviews - 1 ? "button--primary" : "button--ghost"}`}
                      onClick={() => {
                        if (reviewIndex >= totalReviews - 1) {
                          setStep("summary");
                          return;
                        }
                        setReviewIndex((current) => Math.min(totalReviews - 1, current + 1));
                      }}
                      disabled={busy || totalReviews === 0 || !canAdvanceFromCurrentReview}
                      title={
                        !canAdvanceFromCurrentReview ? STR.views.import.reviewAdvanceRequiresDecisionTitle : undefined
                      }
                    >
                      {reviewIndex >= totalReviews - 1 ? STR.views.import.summaryNext : `${STR.views.import.reviewNextEntry} ➡️`}
                    </button>
                  </div>
                </div>
                {activeReview ? (
                  <div className="import-review import-review--cards-scroll">
                    <section
                      className="import-review__incoming"
                      aria-label={STR.views.import.reviewIncomingEyebrow}
                    >
                      <header className="import-review__incoming-header">
                        <span className="import-review__incoming-eyebrow">
                          {STR.views.import.reviewIncomingEyebrow}
                        </span>
                        <h2>{STR.views.import.reviewEntryProgress(reviewIndex + 1, totalReviews)}</h2>
                      </header>
                      <div className="import-review__incoming-lines">
                        {(() => {
                          const inc = activeReview.incoming;
                          if (isDoublesReview) {
                            const [leftName, rightName] = splitPairToken(inc.displayName);
                            if (rightName !== "—") {
                              const [yLeft, yRight] = pairYobsFromReview(inc.yob, activeReview);
                              return (
                                <p className="import-review__incoming-line">
                                  {formatDoublesIncomingSummaryLine(
                                    leftName,
                                    rightName,
                                    yLeft,
                                    yRight,
                                    inc.startNumber,
                                    inc.resultLabel,
                                  )}
                                </p>
                              );
                            }
                          }
                          return (
                            <p className="import-review__incoming-line">
                              {formatSoloIncomingSummaryLine(inc.displayName, inc.yob, inc.startNumber, inc.resultLabel)}
                            </p>
                          );
                        })()}
                      </div>
                      <p className="import-review__incoming-cta">
                        {STR.views.import.reviewIncomingCta}
                      </p>
                    </section>

                    <div className="import-review__cards">
                      <div className="import-review__matches-heading">
                        <h3>{STR.views.import.reviewMatchesHeading}</h3>
                      </div>
                      {visibleCandidates.map((candidate) => {
                        const isSelected = currentDecision?.candidateId === candidate.candidateId;
                        return (
                          <ImportCandidateCard
                            key={candidate.candidateId}
                            candidate={candidate}
                            incoming={activeReview.incoming}
                            isSelected={isSelected}
                            isDoubles={isDoublesReview}
                            disabled={busy}
                            onSelect={() => {
                              stageReviewDecision("merge", candidate.candidateId);
                            }}
                          />
                        );
                      })}
                      {visibleCandidates.length === 0 ? (
                        <div className="import-review__empty-candidates">
                          {STR.views.import.noVisibleCandidates}
                        </div>
                      ) : null}
                      <div
                        className="import-review__fallback-divider"
                        role="separator"
                        aria-label={STR.views.import.reviewFallbackDivider}
                      >
                        <span>{STR.views.import.reviewFallbackDivider}</span>
                      </div>
                      <button
                        type="button"
                        className={`import-candidate import-candidate--new ${currentDecision?.action === "create_new" ? "is-selected" : ""}`}
                        onClick={() => {
                          stageReviewDecision("create_new", null);
                        }}
                        disabled={busy}
                      >
                        <div className="import-candidate__head">
                          <strong>
                            {currentDecision?.action === "create_new"
                              ? `${STR.views.import.reviewCreateNewTitle} - ${STR.views.import.createNewSelected}`
                              : STR.views.import.reviewCreateNewTitle}
                          </strong>
                        </div>
                        <small>{STR.views.import.reviewCreateNewDescription}</small>
                      </button>
                    </div>

                  </div>
                ) : (
                  <p>{STR.views.import.noOpenReviews}</p>
                )}
              </article>
            }
          />
        ) : null}

        {step === "summary" && visibleSummary && draft ? (
          <ContentSplitLayout
            main={
              <article className="surface-card import-step">
                {flowSteps}
                <div className="surface-card__header">
                  <h2>{STR.views.import.summaryTitle}</h2>
                  <p>{STR.views.import.summaryHint}</p>
                </div>
                <ImportSummaryOverview
                  summary={visibleSummary}
                  fileName={draft.fileName}
                  category={draft.category}
                  raceNumber={draft.raceNumber}
                  reviewItems={draft.reviewItems}
                  decisions={draft.reviewItems
                    .map((reviewItem) => {
                      const staged = stagedDecisions[reviewItem.reviewId];
                      if (staged) {
                        return {
                          reviewId: reviewItem.reviewId,
                          action: staged.action,
                          candidateId: staged.candidateId,
                        };
                      }
                      return draft.decisions.find((decision) => decision.reviewId === reviewItem.reviewId) ?? null;
                    })
                    .filter((decision): decision is { reviewId: string; action: ImportReviewAction; candidateId: string | null } => decision != null)}
                />
                <div className="import-step__actions">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => {
                      setStep("review_matches");
                    }}
                    disabled={busy}
                  >
                    {STR.views.import.stepBackToReview}
                  </button>
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => {
                      void finalizeImport();
                    }}
                    disabled={busy}
                  >
                    {STR.views.import.finalizeImport}
                  </button>
                </div>
              </article>
            }
          />
        ) : null}
      </section>

      {step === "review_matches" && draft && isMatchingSettingsOpen ? (
        <div className="confirm-modal__backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-label={STR.views.import.matchingOptionsTitle}>
            <div className="confirm-modal__header">
              <h2>{STR.views.import.matchingOptionsTitle}</h2>
            </div>
            <div className="confirm-modal__body">
              <div className="matching-options">
                <div className="matching-options__modes" role="tablist" aria-label={STR.views.import.matchingModeAria}>
                  <button
                    type="button"
                    className={`button button--tab ${matchingMode === "strict" ? "is-active" : ""}`}
                    onClick={() => {
                      setMatchingMode("strict");
                    }}
                    disabled={busy}
                  >
                    {STR.views.import.matchingModeStrict}
                  </button>
                  <button
                    type="button"
                    className={`button button--tab ${matchingMode === "fuzzy_automatik" ? "is-active" : ""}`}
                    onClick={() => {
                      setMatchingMode("fuzzy_automatik");
                    }}
                    disabled={busy}
                  >
                    {STR.views.import.matchingModeShortFuzzy}
                  </button>
                  <button
                    type="button"
                    className={`button button--tab ${matchingMode === "manuell" ? "is-active" : ""}`}
                    onClick={() => {
                      setMatchingMode("manuell");
                    }}
                    disabled={busy}
                  >
                    {STR.views.import.matchingModeManual}
                  </button>
                </div>
                <div className="matching-options__summary">
                  <span>
                    Effektive Auto-Schwelle: <strong>{thresholdLabel(effectiveAutoThreshold)}</strong>
                  </span>
                </div>
                {matchingMode === "fuzzy_automatik" ? (
                  <div className="matching-options__modes" role="tablist" aria-label={STR.views.import.matchingModeFuzzy}>
                    <button
                      type="button"
                      className={`button button--tab ${fuzzySubMode === "perfect" ? "is-active" : ""}`}
                      onClick={() => {
                        setFuzzySubMode("perfect");
                      }}
                      disabled={busy}
                    >
                      {STR.views.import.matchingFuzzySubPerfect}
                    </button>
                    <button
                      type="button"
                      className={`button button--tab ${fuzzySubMode === "threshold" ? "is-active" : ""}`}
                      onClick={() => {
                        setFuzzySubMode("threshold");
                      }}
                      disabled={busy}
                    >
                      {STR.views.import.matchingFuzzySubThreshold}
                    </button>
                  </div>
                ) : null}
                <label className="matching-options__slider">
                  <span>{STR.views.import.autoThresholdLabel(thresholdLabel(activeMatchingSettings.autoThreshold))}</span>
                  <input
                    type="range"
                    min={MATCHING_THRESHOLD_MIN}
                    max={MATCHING_THRESHOLD_MAX}
                    step={MATCHING_THRESHOLD_STEP}
                    value={activeMatchingSettings.autoThreshold}
                    disabled={busy || matchingMode !== "fuzzy_automatik" || fuzzySubMode === "perfect"}
                    onChange={(event) => {
                      const nextValue = clampThreshold(Number(event.target.value));
                      setMatchingModeSettings((current) => ({
                        ...current,
                        [matchingMode]: {
                          ...current[matchingMode],
                          autoThreshold: nextValue,
                        },
                      }));
                    }}
                  />
                </label>
                <label className="matching-options__slider">
                  <span>{STR.views.import.reviewThresholdLabel(thresholdLabel(cappedReviewThreshold))}</span>
                  <input
                    type="range"
                    min={MATCHING_THRESHOLD_MIN}
                    max={MATCHING_THRESHOLD_MAX}
                    step={MATCHING_THRESHOLD_STEP}
                    value={cappedReviewThreshold}
                    disabled={busy}
                    onChange={(event) => {
                      const nextValue = clampThreshold(Number(event.target.value));
                      const maxReview = effectiveAutoThresholdFromConfig({
                        autoMergeEnabled: matchingMode === "fuzzy_automatik" && fuzzySubMode === "threshold",
                        perfectMatchAutoMerge: matchingMode === "fuzzy_automatik",
                        autoMin: activeMatchingSettings.autoThreshold,
                      });
                      setMatchingModeSettings((current) => ({
                        ...current,
                        [matchingMode]: {
                          ...current[matchingMode],
                          reviewThreshold: Math.min(nextValue, maxReview),
                        },
                      }));
                    }}
                  />
                </label>
                <p className="matching-options__hint">
                  {matchingMode === "strict"
                    ? STR.views.import.matchingModeHintStrict
                    : matchingMode === "manuell"
                      ? STR.views.import.matchingModeHintManual
                      : modeMayAutoMerge
                        ? STR.views.import.matchingModeHintAutoZone
                        : STR.views.import.matchingModeHintReviewList}
                </p>
                <p className="matching-options__hint">
                  {STR.views.import.visibleCandidatesCount(visibleCandidates.length, orderedCandidates.length)}
                </p>
                <label className="matching-options__toggle">
                  <input
                    type="checkbox"
                    checked={autoSelectTopReviewCandidate}
                    onChange={(event) => {
                      setAutoSelectTopReviewCandidate(event.target.checked);
                    }}
                    disabled={busy}
                  />
                  <span>
                    <strong>{STR.views.import.autoSelectTopCandidateLabel}</strong>
                    <small className="matching-options__toggle-hint">{STR.views.import.autoSelectTopCandidateHint}</small>
                  </span>
                </label>
              </div>
            </div>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="button"
                onClick={() => {
                  setIsMatchingSettingsOpen(false);
                }}
              >
                {STR.actions.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {step === "review_matches" && draft && isCorrectionModalOpen ? (
        <div className="confirm-modal__backdrop" role="presentation">
          <div className="confirm-modal confirm-modal--wide import-correction-modal" role="dialog" aria-modal="true" aria-label="Daten korrigieren">
            <div className="confirm-modal__header">
              <h2>Daten korrigieren</h2>
            </div>
            <div className="confirm-modal__body">
              {selectedCorrectionCandidate ? (
                <section className="import-correction-modal__comparison" aria-label="Vergleich">
                  <h3>Vergleich</h3>
                  <div className="import-correction-modal__comparison-grid">
                    {selectedCorrectionCandidate.fieldComparisons.map((comparison) => (
                      <div key={comparison.fieldKey} className="import-correction-modal__comparison-row">
                        <span className="import-correction-modal__comparison-label">{comparison.label}</span>
                        <div>
                          <small>Eingehend</small>
                          <p>{comparison.incomingValue || "—"}</p>
                        </div>
                        <div>
                          <small>Bestand</small>
                          <p>{comparison.candidateValue || "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
              <div className="import-correction-modal__grid">
                {isDoublesReview ? (
                  <>
                    <fieldset className="import-correction-modal__fieldset">
                      <legend>Teilnehmende A</legend>
                      <label>
                        <span>Name</span>
                        <input
                          value={teamCorrection.memberA.name}
                          onChange={(event) => {
                            setTeamCorrection((current) => ({
                              ...current,
                              memberA: { ...current.memberA, name: event.target.value },
                            }));
                          }}
                          disabled={busy}
                        />
                      </label>
                      <label>
                        <span>Jahrgang</span>
                        <input
                          value={teamCorrection.memberA.yob}
                          onChange={(event) => {
                            setTeamCorrection((current) => ({
                              ...current,
                              memberA: { ...current.memberA, yob: event.target.value },
                            }));
                          }}
                          disabled={busy}
                        />
                      </label>
                      <label>
                        <span>Verein</span>
                        <input
                          value={teamCorrection.memberA.club}
                          onChange={(event) => {
                            setTeamCorrection((current) => ({
                              ...current,
                              memberA: { ...current.memberA, club: event.target.value },
                            }));
                          }}
                          disabled={busy}
                        />
                      </label>
                    </fieldset>
                    <fieldset className="import-correction-modal__fieldset">
                      <legend>Teilnehmende B</legend>
                      <label>
                        <span>Name</span>
                        <input
                          value={teamCorrection.memberB.name}
                          onChange={(event) => {
                            setTeamCorrection((current) => ({
                              ...current,
                              memberB: { ...current.memberB, name: event.target.value },
                            }));
                          }}
                          disabled={busy}
                        />
                      </label>
                      <label>
                        <span>Jahrgang</span>
                        <input
                          value={teamCorrection.memberB.yob}
                          onChange={(event) => {
                            setTeamCorrection((current) => ({
                              ...current,
                              memberB: { ...current.memberB, yob: event.target.value },
                            }));
                          }}
                          disabled={busy}
                        />
                      </label>
                      <label>
                        <span>Verein</span>
                        <input
                          value={teamCorrection.memberB.club}
                          onChange={(event) => {
                            setTeamCorrection((current) => ({
                              ...current,
                              memberB: { ...current.memberB, club: event.target.value },
                            }));
                          }}
                          disabled={busy}
                        />
                      </label>
                    </fieldset>
                  </>
                ) : (
                  <div className="import-correction-modal__fieldset">
                    <label>
                      <span>Name</span>
                      <input
                        value={singleCorrection.name}
                        onChange={(event) => {
                          setSingleCorrection((current) => ({ ...current, name: event.target.value }));
                        }}
                        disabled={busy}
                      />
                    </label>
                    <label>
                      <span>Jahrgang</span>
                      <input
                        value={singleCorrection.yob}
                        onChange={(event) => {
                          setSingleCorrection((current) => ({ ...current, yob: event.target.value }));
                        }}
                        disabled={busy}
                      />
                    </label>
                    <label>
                      <span>Verein</span>
                      <input
                        value={singleCorrection.club}
                        onChange={(event) => {
                          setSingleCorrection((current) => ({ ...current, club: event.target.value }));
                        }}
                        disabled={busy}
                      />
                    </label>
                  </div>
                )}
              </div>
              {correctionError ? <p className="danger-text">{correctionError}</p> : null}
            </div>
            <div className="confirm-modal__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  setIsCorrectionModalOpen(false);
                  setCorrectionError(null);
                }}
                disabled={busy}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  void submitCorrection();
                }}
                disabled={busy}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
