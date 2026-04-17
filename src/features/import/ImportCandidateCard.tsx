import type { ImportIncomingRecord, ImportReviewCandidate } from "@/api/contracts/index.ts";
import { STR } from "@/app/strings.ts";
import { splitPairToken } from "@/features/import/split-pair-token.ts";

type ImportCandidateCardProps = {
  candidate: ImportReviewCandidate;
  incoming: ImportIncomingRecord;
  isSelected: boolean;
  isDoubles: boolean;
  disabled: boolean;
  onSelect: () => void;
};

function normalizeForMatch(value: string): string {
  if (value === "—") {
    return "";
  }
  return value.trim().toLowerCase();
}

function pairValueMatches(incomingValue: string, candidateValue: string): boolean {
  return normalizeForMatch(incomingValue) === normalizeForMatch(candidateValue);
}

function splitIntoWords(value: string): string[] {
  return value.split(/\s+/).filter((part) => part.length > 0);
}

function normalizeWord(value: string): string {
  return value.trim().toLowerCase();
}

function buildMismatchMask(value: string, otherValue: string): boolean[] {
  const words = splitIntoWords(value);
  const otherWords = splitIntoWords(otherValue);
  return words.map((word, index) => normalizeWord(word) !== normalizeWord(otherWords[index] ?? ""));
}

function renderWordDiff(value: string, otherValue: string) {
  if (!value.trim()) {
    return value;
  }

  const parts = value.split(/(\s+)/);
  const mismatchMask = buildMismatchMask(value, otherValue);
  let wordIndex = 0;

  return parts.map((part, index) => {
    if (!part.length || /^\s+$/.test(part)) {
      return <span key={`ws-${index}`}>{part}</span>;
    }

    const isMismatch = mismatchMask[wordIndex] ?? false;
    wordIndex += 1;

    if (!isMismatch) {
      return <span key={`word-${index}`}>{part}</span>;
    }

    return (
      <span key={`word-${index}`} className="import-candidate__diff-part">
        {part}
      </span>
    );
  });
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
    <div className={`import-candidate__row ${isMatch ? "is-match" : "is-mismatch"}`}>
      <strong className="import-candidate__field">{label}</strong>
      <span
        className={`import-candidate__status ${isMatch ? "is-match" : "is-mismatch"}`}
        aria-label={isMatch ? "Übereinstimmung" : "Abweichung"}
      >
        {isMatch ? "✅" : "❌"}
      </span>
      <div className="import-candidate__values">
        <div className="import-candidate__value-row">
          <span className="import-candidate__value-label">{STR.importCandidate.incomingLabel}</span>
          <span className="import-candidate__value-text">
            {isMatch ? incomingValue : renderWordDiff(incomingValue, candidateValue)}
          </span>
        </div>
        <div className="import-candidate__value-row">
          <span className="import-candidate__value-label">{STR.importCandidate.existingLabel}</span>
          <span className="import-candidate__value-text">
            {isMatch ? candidateValue : renderWordDiff(candidateValue, incomingValue)}
          </span>
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
  const leftNameMatch = pairValueMatches(incomingSplitLeftName, candidateSplitLeftName);
  const rightNameMatch = pairValueMatches(incomingSplitRightName, candidateSplitRightName);
  const leftYobMatch = pairValueMatches(incomingLeftYob, candidateLeftYob);
  const rightYobMatch = pairValueMatches(incomingRightYob, candidateRightYob);
  const leftClubMatch = pairValueMatches(incomingLeftClub, candidateLeftClub);
  const rightClubMatch = pairValueMatches(incomingRightClub, candidateRightClub);

  return (
    <div className="import-candidate__pair-grid">
      <div className="import-candidate__pair-pane">
        <h4 className="import-candidate__pair-title">
          {incomingLeftName === "—" ? STR.importCandidate.participantA : incomingLeftName}
        </h4>
        <div className="import-candidate__comparison">
          <ComparisonRow
            label={STR.importCandidate.name}
            isMatch={leftNameMatch}
            incomingValue={incomingSplitLeftName}
            candidateValue={candidateSplitLeftName}
          />
          <ComparisonRow
            label={STR.importCandidate.yob}
            isMatch={leftYobMatch}
            incomingValue={incomingLeftYob}
            candidateValue={candidateLeftYob}
          />
          <ComparisonRow
            label={STR.importCandidate.club}
            isMatch={leftClubMatch}
            incomingValue={incomingLeftClub}
            candidateValue={candidateLeftClub}
          />
        </div>
      </div>
      <div className="import-candidate__pair-pane">
        <h4 className="import-candidate__pair-title">
          {incomingRightName === "—" ? STR.importCandidate.participantB : incomingRightName}
        </h4>
        <div className="import-candidate__comparison">
          <ComparisonRow
            label={STR.importCandidate.name}
            isMatch={rightNameMatch}
            incomingValue={incomingSplitRightName}
            candidateValue={candidateSplitRightName}
          />
          <ComparisonRow
            label={STR.importCandidate.yob}
            isMatch={rightYobMatch}
            incomingValue={incomingRightYob}
            candidateValue={candidateRightYob}
          />
          <ComparisonRow
            label={STR.importCandidate.club}
            isMatch={rightClubMatch}
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
}: ImportCandidateCardProps) {
  const displayName = isSelected
    ? STR.importCandidate.selectedDisplayName(candidate.displayName, STR.views.import.selectedSuffix)
    : candidate.displayName;

  return (
    <button
      type="button"
      className={`import-candidate ${isSelected ? "is-selected" : ""}`}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={isSelected}
    >
      <div className="import-candidate__head">
        <div className="import-candidate__identity">
          <strong className="import-candidate__name">{displayName}</strong>
        </div>
      </div>
      <small className="import-candidate__hint">
        {STR.importCandidate.assignmentHint}
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
    </button>
  );
}
