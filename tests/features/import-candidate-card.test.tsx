import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ImportIncomingRecord, ImportReviewCandidate } from "@/api/contracts/index.ts";
import { ImportCandidateCard } from "@/features/import/ImportCandidateCard.tsx";

describe("ImportCandidateCard doubles comparison", () => {
  it("renders per-participant match indicators instead of mirrored field flags", () => {
    const incoming: ImportIncomingRecord = {
      displayName: "Lea Beispiel / Tom Beispiel",
      yob: 0,
      club: "Club A / Club B",
      startNumber: 12,
      resultLabel: "8,0 km / 22 P",
    };

    const candidate: ImportReviewCandidate = {
      candidateId: "team-1",
      displayName: "Lea Beispiel / Tom Beispiel",
      confidence: 0.93,
      isRecommended: true,
      fieldComparisons: [
        {
          fieldKey: "name",
          label: "Name",
          incomingValue: "Lea Beispiel / Tom Beispiel",
          candidateValue: "Lea Beispiel / Tom Beispiel",
          isMatch: true,
        },
        {
          fieldKey: "yob",
          label: "Jahrgang",
          incomingValue: "1992 / 1990",
          candidateValue: "1991 / 1990",
          isMatch: false,
        },
        {
          fieldKey: "club",
          label: "Verein",
          incomingValue: "Club A / Club B",
          candidateValue: "Club A / Club C",
          isMatch: false,
        },
      ],
    };

    render(
      <ImportCandidateCard
        candidate={candidate}
        incoming={incoming}
        isSelected={false}
        isDoubles
        disabled={false}
        onSelect={() => {}}
        recommendedLabel="Empfohlen"
      />,
    );

    expect(screen.getAllByText("✅")).toHaveLength(4);
    expect(screen.getAllByText("❌")).toHaveLength(2);
  });
});

describe("ImportCandidateCard mismatch highlighting", () => {
  it("highlights mismatching words for incoming and existing values", () => {
    const incoming: ImportIncomingRecord = {
      displayName: "John Doe",
      yob: 1993,
      club: "Club Alpha",
      startNumber: 44,
      resultLabel: "7,2 km / 20 P",
    };

    const candidate: ImportReviewCandidate = {
      candidateId: "single-1",
      displayName: "Jon Doe",
      confidence: 0.84,
      isRecommended: false,
      fieldComparisons: [
        {
          fieldKey: "name",
          label: "Name",
          incomingValue: "John Doe",
          candidateValue: "Jon Doe",
          isMatch: false,
        },
        {
          fieldKey: "yob",
          label: "Jahrgang",
          incomingValue: "1993",
          candidateValue: "1993",
          isMatch: true,
        },
      ],
    };

    const { container } = render(
      <ImportCandidateCard
        candidate={candidate}
        incoming={incoming}
        isSelected={false}
        isDoubles={false}
        disabled={false}
        onSelect={() => {}}
        recommendedLabel="Empfohlen"
      />,
    );

    const highlightedParts = container.querySelectorAll(".import-candidate__diff-part");
    expect(highlightedParts).toHaveLength(2);
    expect(highlightedParts[0]?.textContent).toBe("John");
    expect(highlightedParts[1]?.textContent).toBe("Jon");
    expect(screen.getAllByText("Doe")).toHaveLength(2);
  });
});
