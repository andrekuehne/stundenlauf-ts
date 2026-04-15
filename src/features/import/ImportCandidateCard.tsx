import type { ImportIncomingRecord, ImportReviewCandidate } from "@/api/contracts/index.ts";

type ImportCandidateCardProps = {
  candidate: ImportReviewCandidate;
  incoming: ImportIncomingRecord;
  isSelected: boolean;
  isDoubles: boolean;
  disabled: boolean;
  onSelect: () => void;
  recommendedLabel: string;
};

function splitPairToken(value: string | null | undefined): [string, string] {
  if (!value || value === "—") {
    return ["—", "—"];
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  const parts = normalized
    .split(/\s*(?:\+|\/|&| und )\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return [parts[0] ?? "—", parts[1] ?? "—"];
  }

  return [normalized, "—"];
}

function ComparisonRow({
  label,
  isMatch,
  incomingValue,
  candidateValue,
}: {
  label: string;
  isMatch: boolean;
  incomingValue: string;
  candidateValue: string;
}) {
  return (
    <div className="import-candidate__row">
      <strong className="import-candidate__field">{label}</strong>
      <span className={`import-candidate__status ${isMatch ? "is-match" : "is-mismatch"}`}>{isMatch ? "✅" : "❌"}</span>
      <div className="import-candidate__values">
        <div className="import-candidate__value-row">
          <span className="import-candidate__value-label">Neu:</span>
          <span>{incomingValue}</span>
        </div>
        <div className="import-candidate__value-row">
          <span className="import-candidate__value-label">Bestand:</span>
          <span>{candidateValue}</span>
        </div>
      </div>
    </div>
  );
}

function DoublesComparison({ candidate, incoming }: { candidate: ImportReviewCandidate; incoming: ImportIncomingRecord }) {
  const [incomingLeftName, incomingRightName] = splitPairToken(incoming.displayName);
  const nameComparison = candidate.fieldComparisons.find((item) => item.fieldKey === "name");
  const yobComparison = candidate.fieldComparisons.find((item) => item.fieldKey === "yob");
  const clubComparison = candidate.fieldComparisons.find((item) => item.fieldKey === "club");

  const [incomingSplitLeftName, incomingSplitRightName] = splitPairToken(nameComparison?.incomingValue);
  const [candidateSplitLeftName, candidateSplitRightName] = splitPairToken(nameComparison?.candidateValue);
  const [incomingLeftYob, incomingRightYob] = splitPairToken(yobComparison?.incomingValue);
  const [candidateLeftYob, candidateRightYob] = splitPairToken(yobComparison?.candidateValue);
  const [incomingLeftClub, incomingRightClub] = splitPairToken(clubComparison?.incomingValue);
  const [candidateLeftClub, candidateRightClub] = splitPairToken(clubComparison?.candidateValue);

  return (
    <div className="import-candidate__pair-grid">
      <div className="import-candidate__pair-pane">
        <h4>{incomingLeftName === "—" ? "Teilnehmende A" : incomingLeftName}</h4>
        <div className="import-candidate__comparison">
          <ComparisonRow
            label="Name"
            isMatch={Boolean(nameComparison?.isMatch)}
            incomingValue={incomingSplitLeftName}
            candidateValue={candidateSplitLeftName}
          />
          <ComparisonRow
            label="Jahrgang"
            isMatch={Boolean(yobComparison?.isMatch)}
            incomingValue={incomingLeftYob}
            candidateValue={candidateLeftYob}
          />
          <ComparisonRow
            label="Verein"
            isMatch={Boolean(clubComparison?.isMatch)}
            incomingValue={incomingLeftClub}
            candidateValue={candidateLeftClub}
          />
        </div>
      </div>
      <div className="import-candidate__pair-pane">
        <h4>{incomingRightName === "—" ? "Teilnehmende B" : incomingRightName}</h4>
        <div className="import-candidate__comparison">
          <ComparisonRow
            label="Name"
            isMatch={Boolean(nameComparison?.isMatch)}
            incomingValue={incomingSplitRightName}
            candidateValue={candidateSplitRightName}
          />
          <ComparisonRow
            label="Jahrgang"
            isMatch={Boolean(yobComparison?.isMatch)}
            incomingValue={incomingRightYob}
            candidateValue={candidateRightYob}
          />
          <ComparisonRow
            label="Verein"
            isMatch={Boolean(clubComparison?.isMatch)}
            incomingValue={incomingRightClub}
            candidateValue={candidateRightClub}
          />
        </div>
      </div>
    </div>
  );
}

export function ImportCandidateCard({
  candidate,
  incoming,
  isSelected,
  isDoubles,
  disabled,
  onSelect,
  recommendedLabel,
}: ImportCandidateCardProps) {
  const displayName = isSelected ? `${candidate.displayName} - ausgewählt` : candidate.displayName;

  return (
    <button
      type="button"
      className={`import-candidate ${isSelected ? "is-selected" : ""}`}
      onClick={onSelect}
      disabled={disabled}
    >
      <div className="import-candidate__head">
        <strong>{displayName}</strong>
        {candidate.isRecommended ? <span className="import-candidate__badge">{recommendedLabel}</span> : null}
      </div>
      <small className="import-candidate__hint">
        Bei Auswahl werden die eingehenden Ergebnisse dieser Person bzw. diesem Team zugeordnet.
      </small>
      {isDoubles ? (
        <DoublesComparison candidate={candidate} incoming={incoming} />
      ) : (
        <div className="import-candidate__comparison">
          {candidate.fieldComparisons.map((comparison) => (
            <ComparisonRow
              key={comparison.fieldKey}
              label={comparison.label}
              isMatch={comparison.isMatch}
              incomingValue={comparison.incomingValue}
              candidateValue={comparison.candidateValue}
            />
          ))}
        </div>
      )}
      <div className="import-candidate__footer">
        <span className="import-candidate__confidence">{Math.round(candidate.confidence * 100)} % Treffer</span>
      </div>
    </button>
  );
}
