import { useEffect, useMemo, useState } from "react";
import type { ImportDraftState, ImportReviewAction, ImportedRunRow } from "@/api/contracts/index.ts";
import { useAppApi } from "@/api/provider.tsx";
import { useAppShellContext } from "@/app/shell-context.ts";
import { STR } from "@/app/strings.ts";
import { useStatusStore } from "@/stores/status.ts";

type StepKey = "select_file" | "review_matches" | "summary";

const FLOW_STEPS: Array<{ key: StepKey; label: string }> = [
  { key: "select_file", label: STR.views.import.flowStepSelect },
  { key: "review_matches", label: STR.views.import.flowStepReview },
  { key: "summary", label: STR.views.import.flowStepSummary },
];

export function ImportPage() {
  const api = useAppApi();
  const { shellData, refreshShellData, setSidebarControls } = useAppShellContext();
  const setStatus = useStatusStore((state) => state.setStatus);
  const [importedRuns, setImportedRuns] = useState<ImportedRunRow[]>([]);
  const [step, setStep] = useState<StepKey>("select_file");
  const [draft, setDraft] = useState<ImportDraftState | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [fileName, setFileName] = useState("");
  const [category, setCategory] = useState<"singles" | "doubles">("singles");
  const [raceNumber, setRaceNumber] = useState("");
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    if (!shellData.selectedSeasonId) {
      setSidebarControls(null);
      return;
    }

    setSidebarControls(
      <div className="sidebar-controls">
        <section className="sidebar-controls__section">
          <h4>{STR.views.standings.importedRunsTitle}</h4>
          {importedRuns.length === 0 ? (
            <p>{STR.views.standings.noRows}</p>
          ) : (
            <div className="table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>{STR.views.standings.importedRunsRaceCol}</th>
                    {importedRuns.map((entry) => (
                      <th key={entry.raceLabel} className="ui-table__cell--center">
                        {entry.raceLabel.replace("Lauf ", "")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>{STR.views.standings.importedRunsRowSingles}</th>
                    {importedRuns.map((entry) => (
                      <td key={`single-${entry.raceLabel}`} className="ui-table__cell--center">
                        {entry.categoryLabel.includes("Paare") ? "—" : "x"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th>{STR.views.standings.importedRunsRowCouples}</th>
                    {importedRuns.map((entry) => (
                      <td key={`couples-${entry.raceLabel}`} className="ui-table__cell--center">
                        {entry.categoryLabel.includes("Paare") ? "x" : "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>,
    );

    return () => {
      setSidebarControls(null);
    };
  }, [importedRuns, setSidebarControls, shellData.selectedSeasonId]);

  const canStartImport =
    Boolean(shellData.selectedSeasonId) && fileName.trim().length > 0 && Number.parseInt(raceNumber, 10) > 0;
  const activeReview = draft?.reviewItems[reviewIndex] ?? null;
  const totalReviews = draft?.reviewItems.length ?? 0;
  const currentDecision =
    activeReview && draft
      ? draft.decisions.find((decision) => decision.reviewId === activeReview.reviewId) ?? null
      : null;

  const visibleSummary = useMemo(() => {
    if (!draft) {
      return null;
    }
    return draft.summary;
  }, [draft]);

  async function startDraft() {
    if (!shellData.selectedSeasonId || !canStartImport) {
      return;
    }
    setBusy(true);
    try {
      const race = Number.parseInt(raceNumber, 10);
      const nextDraft = await api.createImportDraft({
        seasonId: shellData.selectedSeasonId,
        fileName: fileName.trim(),
        category,
        raceNumber: race,
      });
      setDraft(nextDraft);
      setReviewIndex(0);
      setStep("review_matches");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : STR.views.import.importDraftFailed;
      setStatus({ severity: "error", source: "import", message });
    } finally {
      setBusy(false);
    }
  }

  async function applyReviewDecision(action: ImportReviewAction, candidateId: string | null) {
    if (!draft || !activeReview) {
      return;
    }
    setBusy(true);
    try {
      const nextDraft = await api.setImportReviewDecision(draft.draftId, {
        reviewId: activeReview.reviewId,
        action,
        candidateId,
      });
      setDraft(nextDraft);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : STR.views.import.importFailed;
      setStatus({ severity: "error", source: "import", message });
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
      const result = await api.finalizeImportDraft(draft.draftId);
      await refreshShellData();
      setStatus({ severity: result.severity, source: "import", message: result.message });
      setDraft(null);
      setRaceNumber("");
      setFileName("");
      setCategory("singles");
      setReviewIndex(0);
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
        <header className="page-header">
          <h1>{STR.views.import.title}</h1>
          <p>{STR.views.standings.noSeason}</p>
        </header>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1>{STR.views.import.title}</h1>
        <p>{STR.views.import.subtitle}</p>
      </header>

      <section className="import-workflow">
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
                <span>{entry.label}</span>
              </li>
            );
          })}
        </ol>

        {step === "select_file" ? (
          <article className="surface-card import-step">
            <div className="surface-card__header">
              <h2>{STR.views.import.selectFileTitle}</h2>
              <p>{STR.views.import.selectFileHint}</p>
            </div>
            <div className="import-step__form">
              <label className="import-controls__label">
                <span>{STR.views.import.fileNameLabel}</span>
                <input
                  value={fileName}
                  onChange={(event) => setFileName(event.target.value)}
                  placeholder="lauf4-mw.xlsx"
                  disabled={busy}
                />
              </label>

              <div className="import-controls__label">
                <span>{STR.views.import.pickFile}</span>
                <div className="import-controls__toggle">
                  <button
                    type="button"
                    className={`button button--tab ${category === "singles" ? "is-active" : ""}`}
                    onClick={() => setCategory("singles")}
                    disabled={busy}
                  >
                    {STR.views.import.singles}
                  </button>
                  <button
                    type="button"
                    className={`button button--tab ${category === "doubles" ? "is-active" : ""}`}
                    onClick={() => setCategory("doubles")}
                    disabled={busy}
                  >
                    {STR.views.import.couples}
                  </button>
                </div>
              </div>

              <label className="import-controls__label">
                <span>{STR.views.import.raceNumber}</span>
                <input
                  type="number"
                  min={1}
                  value={raceNumber}
                  onChange={(event) => setRaceNumber(event.target.value)}
                  placeholder="4"
                  disabled={busy}
                />
              </label>
            </div>
            <div className="import-step__actions">
              <button type="button" className="button button--primary" onClick={startDraft} disabled={!canStartImport || busy}>
                {STR.views.import.stepNextToReview}
              </button>
            </div>
          </article>
        ) : null}

        {step === "review_matches" && draft ? (
          <article className="surface-card import-step">
            <div className="surface-card__header">
              <h2>{STR.views.import.reviewTitle}</h2>
              <p>{STR.views.import.reviewProgressShort(reviewIndex + 1, totalReviews)}</p>
            </div>
            {activeReview ? (
              <div className="import-review">
                <div className="import-review__incoming">
                  <h3>{STR.views.import.incomingHeading}</h3>
                  <p className="import-review__incoming-name">{activeReview.incoming.displayName}</p>
                  <dl>
                    <div>
                      <dt>{STR.views.import.reviewYob}</dt>
                      <dd>{activeReview.incoming.yob}</dd>
                    </div>
                    <div>
                      <dt>{STR.views.import.reviewClub}</dt>
                      <dd>{activeReview.incoming.club || "—"}</dd>
                    </div>
                    <div>
                      <dt>Startnr.</dt>
                      <dd>{activeReview.incoming.startNumber}</dd>
                    </div>
                    <div>
                      <dt>Wertung</dt>
                      <dd>{activeReview.incoming.resultLabel}</dd>
                    </div>
                  </dl>
                </div>

                <div className="import-review__cards">
                  {activeReview.candidates.map((candidate) => {
                    const isSelected = currentDecision?.candidateId === candidate.candidateId;
                    return (
                      <button
                        key={candidate.candidateId}
                        type="button"
                        className={`import-candidate ${isSelected ? "is-selected" : ""}`}
                        onClick={() => applyReviewDecision("merge", candidate.candidateId)}
                        disabled={busy}
                      >
                        <div className="import-candidate__head">
                          <strong>{candidate.displayName}</strong>
                          {candidate.isRecommended ? <span className="import-candidate__badge">{STR.views.import.reviewRecommended}</span> : null}
                        </div>
                        <small>{Math.round(candidate.confidence * 100)} % Treffer</small>
                        <div className="import-candidate__comparison">
                          {candidate.fieldComparisons.map((comparison) => (
                            <div key={comparison.fieldKey} className="import-candidate__row">
                              <strong>{comparison.label}</strong>
                              {comparison.isMatch ? (
                                <span>✅ gleich</span>
                              ) : (
                                <span>
                                  ❌ abweichend
                                  <br />
                                  Neuer Eintrag: {comparison.incomingValue}
                                  <br />
                                  Bestand: {comparison.candidateValue}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`import-candidate import-candidate--new ${currentDecision?.action === "create_new" ? "is-selected" : ""}`}
                    onClick={() => applyReviewDecision("create_new", null)}
                    disabled={busy}
                  >
                    <div className="import-candidate__head">
                      <strong>{STR.views.import.reviewCreateNewTitle}</strong>
                    </div>
                    <small>{STR.views.import.reviewCreateNewDescription}</small>
                  </button>
                </div>

                <div className="import-review__actions">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => setReviewIndex((current) => Math.max(0, current - 1))}
                    disabled={reviewIndex === 0 || busy}
                  >
                    {STR.views.import.reviewBackEntry}
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => setReviewIndex((current) => Math.min(totalReviews - 1, current + 1))}
                    disabled={reviewIndex >= totalReviews - 1 || busy}
                  >
                    {STR.views.import.reviewNextEntry}
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={!currentDecision?.candidateId || busy}
                    onClick={() =>
                      currentDecision?.candidateId
                        ? applyReviewDecision("merge_with_typo_fix", currentDecision.candidateId)
                        : undefined
                    }
                  >
                    {STR.views.import.reviewTypoFix}
                  </button>
                </div>
              </div>
            ) : (
              <p>{STR.views.import.noOpenReviews}</p>
            )}
            <div className="import-step__actions">
              <button type="button" className="button button--ghost" onClick={() => setStep("select_file")} disabled={busy}>
                {STR.views.import.stepBackToSelection}
              </button>
              <button type="button" className="button button--primary" onClick={() => setStep("summary")} disabled={busy}>
                {STR.views.import.flowStepSummary}
              </button>
            </div>
          </article>
        ) : null}

        {step === "summary" && visibleSummary ? (
          <article className="surface-card import-step">
            <div className="surface-card__header">
              <h2>{STR.views.import.summaryTitle}</h2>
              <p>{STR.views.import.summaryHint}</p>
            </div>
            <div className="import-summary-grid">
              <div className="summary-card">
                <span>{STR.views.import.summaryImportedEntries}</span>
                <strong>{visibleSummary.importedEntries}</strong>
              </div>
              <div className="summary-card">
                <span>{STR.views.import.summaryMergedEntries}</span>
                <strong>{visibleSummary.mergedEntries}</strong>
              </div>
              <div className="summary-card">
                <span>{STR.views.import.summaryNewPersons}</span>
                <strong>{visibleSummary.newPersonsCreated}</strong>
              </div>
              <div className="summary-card">
                <span>{STR.views.import.summaryTypoFixes}</span>
                <strong>{visibleSummary.typoCorrections}</strong>
              </div>
            </div>
            <section className="surface-card__section">
              <h3>{STR.views.import.summaryWarnings}</h3>
              {visibleSummary.warnings.length === 0 ? (
                <p>{STR.views.import.summaryNoWarnings}</p>
              ) : (
                <ul>
                  {visibleSummary.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </section>
            <div className="import-step__actions">
              <button type="button" className="button button--ghost" onClick={() => setStep("review_matches")} disabled={busy}>
                {STR.views.import.stepBackToReview}
              </button>
              <button type="button" className="button button--primary" onClick={finalizeImport} disabled={busy}>
                {STR.views.import.finalizeImport}
              </button>
            </div>
          </article>
        ) : null}
      </section>
    </div>
  );
}
