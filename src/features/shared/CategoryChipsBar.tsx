import type { StandingsCategory } from "@/api/contracts/index.ts";
import { STR } from "@/app/strings.ts";

type CategoryRowDescriptor = {
  id: "half_hour" | "hour";
  label: string;
  keys: string[];
};

const CATEGORY_ROWS: CategoryRowDescriptor[] = [
  {
    id: "half_hour",
    label: STR.views.standings.categoryRowHalfHour,
    keys: [
      "half_hour:women",
      "half_hour:men",
      "half_hour:couples_women",
      "half_hour:couples_men",
      "half_hour:couples_mixed",
    ],
  },
  {
    id: "hour",
    label: STR.views.standings.categoryRowHour,
    keys: [
      "hour:women",
      "hour:men",
      "hour:couples_women",
      "hour:couples_men",
      "hour:couples_mixed",
    ],
  },
];

function categoryButtonLabel(key: string): string {
  const [duration, division] = key.split(":");
  const durationLabel = duration === "half_hour" ? "1/2 h" : "1 h";
  const divisionLabel = division?.startsWith("couples_")
    ? division === "couples_women"
      ? "Paare F"
      : division === "couples_men"
        ? "Paare M"
        : "Paare Mix"
    : division === "women"
      ? "Frauen"
      : "Männer";
  return `${durationLabel} - ${divisionLabel}`;
}

interface CategoryChipsBarProps {
  categories: StandingsCategory[];
  selectedCategoryKey: string | null;
  onSelect: (key: string) => void;
}

export function CategoryChipsBar({ categories, selectedCategoryKey, onSelect }: CategoryChipsBarProps) {
  return (
    <div
      className="standings-overview__category-rows"
      role="group"
      aria-label={STR.views.standings.categoriesTitle}
    >
      {CATEGORY_ROWS.map((row) => (
        <div key={row.id} className="standings-overview__category-row">
          <span className="standings-overview__category-row-label">{row.label}</span>
          <div className="standings-overview__category-row-chips">
            {row.keys.map((categoryKey) => {
              const category = categories.find((entry) => entry.key === categoryKey) ?? null;
              const isDisabled = !category || category.participantCount === 0;
              const isActive = selectedCategoryKey === categoryKey;
              const chipClass = [
                "standings-overview__category-chip",
                isActive ? "is-active" : "",
                isDisabled ? "is-disabled" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={categoryKey}
                  type="button"
                  className={chipClass}
                  aria-pressed={isActive}
                  disabled={isDisabled}
                  onClick={() => {
                    if (category) {
                      onSelect(category.key);
                    }
                  }}
                >
                  <strong>{categoryButtonLabel(categoryKey).split(" - ")[1]}</strong>
                  <span className="standings-overview__category-chip-meta">
                    {category && category.participantCount > 0
                      ? `${category.participantCount} Teams`
                      : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
