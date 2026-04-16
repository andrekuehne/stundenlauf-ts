import type {
  ImportCategory,
  ImportDraftSummary,
  ImportReviewAction,
  ImportReviewItem,
} from "@/api/contracts/index.ts";
import { STR } from "@/app/strings.ts";

type DecisionLike = {
  reviewId: string;
  action: ImportReviewAction;
  candidateId: string | null;
};

type ImportSummaryOverviewProps = {
  summary: ImportDraftSummary;
  fileName: string;
  category: ImportCategory;
  raceNumber: number;
  reviewItems: ImportReviewItem[];
  decisions: DecisionLike[];
};

type DecisionRow = {
  reviewId: string;
  incomingLabel: string;
  actionLabel: string;
  actionModifier: "merge" | "typo" | "create";
  targetLabel: string;
};

function categoryLabel(category: ImportCategory): string {
  return category === "doubles" ? STR.views.import.couples : STR.views.import.singles;
}

function incomingLabelFor(item: ImportReviewItem): string {
  const name = item.incoming.displayName.trim() || "—";
  const yob = item.incoming.yob;
  return Number.isFinite(yob) && yob > 0 ? `${name} (${yob})` : name;
}

function actionLabelFor(action: ImportReviewAction): { label: string; modifier: DecisionRow["actionModifier"] } {
  if (action === "merge_with_typo_fix") {
    return { label: STR.views.import.summaryDecisionTypoFix, modifier: "typo" };
  }
  if (action === "create_new") {
    return { label: STR.views.import.summaryDecisionCreateNew, modifier: "create" };
  }
  return { label: STR.views.import.summaryDecisionMerge, modifier: "merge" };
}

function targetLabelFor(item: ImportReviewItem, decision: DecisionLike): string {
  if (decision.action === "create_new" || decision.candidateId == null) {
    return STR.views.import.summaryDecisionCreateNewTarget;
  }
  const match = item.candidates.find((candidate) => candidate.candidateId === decision.candidateId);
  return match?.displayName ?? STR.views.import.summaryDecisionCreateNewTarget;
}

function buildDecisionRows(reviewItems: ImportReviewItem[], decisions: DecisionLike[]): DecisionRow[] {
  const decisionByReview = new Map(decisions.map((decision) => [decision.reviewId, decision]));
  return reviewItems
    .map((item): DecisionRow | null => {
      const decision = decisionByReview.get(item.reviewId);
      if (!decision) {
        return null;
      }
      const action = actionLabelFor(decision.action);
      return {
        reviewId: item.reviewId,
        incomingLabel: incomingLabelFor(item),
        actionLabel: action.label,
        actionModifier: action.modifier,
        targetLabel: targetLabelFor(item, decision),
      };
    })
    .filter((row): row is DecisionRow => row != null);
}

export function ImportSummaryOverview({
  summary,
  fileName,
  category,
  raceNumber,
  reviewItems,
  decisions,
}: ImportSummaryOverviewProps) {
  const decisionRows = buildDecisionRows(reviewItems, decisions);
  const manualCount = decisionRows.length;
  const headline = STR.views.import.summaryContextHeadline(categoryLabel(category), raceNumber);

  return (
    <section className="import-summary" aria-label={STR.views.import.summaryTitle}>
      <section className="import-summary__context" aria-label={STR.views.import.summaryContextEyebrow}>
        <span className="import-summary__context-eyebrow">
          {STR.views.import.summaryContextEyebrow}
        </span>
        <h3 className="import-summary__context-headline">{headline}</h3>
        <p className="import-summary__context-file">
          <span className="import-summary__context-file-label">
            {STR.views.import.summaryContextFileLabel}:
          </span>{" "}
          <span className="import-summary__context-file-name">{fileName}</span>
        </p>
      </section>

      <div className="import-summary__kpis">
        <div className="summary-card import-summary__kpi import-summary__kpi--imported">
          <span>{STR.views.import.summaryImportedEntries}</span>
          <strong>{summary.importedEntries}</strong>
        </div>
        <div className="summary-card import-summary__kpi import-summary__kpi--new">
          <span>{STR.views.import.summaryNewPersons}</span>
          <strong>{summary.newPersonsCreated}</strong>
        </div>
        <div className="summary-card import-summary__kpi import-summary__kpi--manual">
          <span>{STR.views.import.summaryManualDecisions}</span>
          <strong>{manualCount}</strong>
        </div>
      </div>

      <section className="import-summary__decisions" aria-label={STR.views.import.summaryDecisionsTitle}>
        <header className="import-summary__decisions-header">
          <h3>{STR.views.import.summaryDecisionsTitle}</h3>
          <p>{STR.views.import.summaryDecisionsHint}</p>
        </header>
        {decisionRows.length === 0 ? (
          <p className="import-summary__decisions-empty">
            {STR.views.import.summaryDecisionsEmpty}
          </p>
        ) : (
          <div className="table-wrap import-summary__decisions-table-wrap">
            <table className="ui-table import-summary__decisions-table">
              <thead>
                <tr>
                  <th>{STR.views.import.summaryDecisionsColEntry}</th>
                  <th>{STR.views.import.summaryDecisionsColAction}</th>
                  <th>{STR.views.import.summaryDecisionsColTarget}</th>
                </tr>
              </thead>
              <tbody>
                {decisionRows.map((row) => (
                  <tr key={row.reviewId}>
                    <td className="import-summary__decisions-entry">{row.incomingLabel}</td>
                    <td>
                      <span
                        className={`import-summary__decision-tag import-summary__decision-tag--${row.actionModifier}`}
                      >
                        {row.actionLabel}
                      </span>
                    </td>
                    <td className="import-summary__decisions-target">{row.targetLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
