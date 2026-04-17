import { useState } from "react";
import type { StandingsRowIdentity, StandingsRowIdentityMember } from "@/api/contracts/index.ts";
import { STR } from "@/app/strings.ts";

type MemberDraft = {
  name: string;
  yob: string;
  club: string;
};

function memberDraftFromIdentity(member: StandingsRowIdentityMember): MemberDraft {
  return {
    name: member.name,
    yob: String(member.yob),
    club: member.club,
  };
}

interface CorrectionModalProps {
  identity: StandingsRowIdentity;
  busy: boolean;
  /** API-level error to display after a failed save attempt */
  saveError: string | null;
  onSave: (members: StandingsRowIdentityMember[]) => void;
  onCancel: () => void;
}

export function CorrectionModal({ identity, busy, saveError, onSave, onCancel }: CorrectionModalProps) {
  const isCouple = identity.teamKind === "couple";
  const [memberA, setMemberA] = useState<MemberDraft>(
    () => memberDraftFromIdentity(identity.members[0] ?? { personId: "", name: "", yob: 0, club: "" }),
  );
  const [memberB, setMemberB] = useState<MemberDraft>(
    () => memberDraftFromIdentity(identity.members[1] ?? { personId: "", name: "", yob: 0, club: "" }),
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const currentYear = new Date().getUTCFullYear();
  function parseYob(raw: string): number {
    return Number.parseInt(raw.trim(), 10);
  }
  function isValidYob(v: number): boolean {
    return Number.isInteger(v) && v >= 1900 && v <= currentYear + 1;
  }

  function handleSave() {
    setValidationError(null);

    if (isCouple) {
      const yobA = parseYob(memberA.yob);
      const yobB = parseYob(memberB.yob);
      if (
        memberA.name.trim() === "" ||
        memberB.name.trim() === "" ||
        !isValidYob(yobA) ||
        !isValidYob(yobB)
      ) {
        setValidationError(STR.views.corrections.errorRequired);
        return;
      }
      onSave([
        {
          personId: identity.members[0]?.personId ?? "",
          name: memberA.name.trim(),
          yob: yobA,
          club: memberA.club.trim(),
        },
        {
          personId: identity.members[1]?.personId ?? "",
          name: memberB.name.trim(),
          yob: yobB,
          club: memberB.club.trim(),
        },
      ]);
    } else {
      const yob = parseYob(memberA.yob);
      if (memberA.name.trim() === "" || !isValidYob(yob)) {
        setValidationError(STR.views.corrections.errorRequired);
        return;
      }
      onSave([
        {
          personId: identity.members[0]?.personId ?? "",
          name: memberA.name.trim(),
          yob,
          club: memberA.club.trim(),
        },
      ]);
    }
  }

  const displayError = validationError ?? saveError;

  return (
    <div className="confirm-modal__backdrop" role="presentation">
      <div
        className="confirm-modal confirm-modal--wide import-correction-modal"
        role="dialog"
        aria-modal="true"
        aria-label={STR.views.corrections.correctionModalTitle}
      >
        <div className="confirm-modal__header">
          <h2>{STR.views.corrections.correctionModalTitle}</h2>
        </div>
        <div className="confirm-modal__body">
          <div className="import-correction-modal__grid">
            {isCouple ? (
              <>
                <fieldset className="import-correction-modal__fieldset">
                  <legend>{STR.views.corrections.memberALabel}</legend>
                  <label>
                    <span>{STR.views.corrections.fieldName}</span>
                    <input
                      value={memberA.name}
                      onChange={(e) => setMemberA((prev) => ({ ...prev, name: e.target.value }))}
                      disabled={busy}
                    />
                  </label>
                  <label>
                    <span>{STR.views.corrections.fieldYob}</span>
                    <input
                      value={memberA.yob}
                      onChange={(e) => setMemberA((prev) => ({ ...prev, yob: e.target.value }))}
                      disabled={busy}
                    />
                  </label>
                  <label>
                    <span>{STR.views.corrections.fieldClub}</span>
                    <input
                      value={memberA.club}
                      onChange={(e) => setMemberA((prev) => ({ ...prev, club: e.target.value }))}
                      disabled={busy}
                    />
                  </label>
                </fieldset>
                <fieldset className="import-correction-modal__fieldset">
                  <legend>{STR.views.corrections.memberBLabel}</legend>
                  <label>
                    <span>{STR.views.corrections.fieldName}</span>
                    <input
                      value={memberB.name}
                      onChange={(e) => setMemberB((prev) => ({ ...prev, name: e.target.value }))}
                      disabled={busy}
                    />
                  </label>
                  <label>
                    <span>{STR.views.corrections.fieldYob}</span>
                    <input
                      value={memberB.yob}
                      onChange={(e) => setMemberB((prev) => ({ ...prev, yob: e.target.value }))}
                      disabled={busy}
                    />
                  </label>
                  <label>
                    <span>{STR.views.corrections.fieldClub}</span>
                    <input
                      value={memberB.club}
                      onChange={(e) => setMemberB((prev) => ({ ...prev, club: e.target.value }))}
                      disabled={busy}
                    />
                  </label>
                </fieldset>
              </>
            ) : (
              <div className="import-correction-modal__fieldset">
                <label>
                  <span>{STR.views.corrections.fieldName}</span>
                  <input
                    value={memberA.name}
                    onChange={(e) => setMemberA((prev) => ({ ...prev, name: e.target.value }))}
                    disabled={busy}
                  />
                </label>
                <label>
                  <span>{STR.views.corrections.fieldYob}</span>
                  <input
                    value={memberA.yob}
                    onChange={(e) => setMemberA((prev) => ({ ...prev, yob: e.target.value }))}
                    disabled={busy}
                  />
                </label>
                <label>
                  <span>{STR.views.corrections.fieldClub}</span>
                  <input
                    value={memberA.club}
                    onChange={(e) => setMemberA((prev) => ({ ...prev, club: e.target.value }))}
                    disabled={busy}
                  />
                </label>
              </div>
            )}
          </div>
          {displayError ? <p className="danger-text">{displayError}</p> : null}
        </div>
        <div className="confirm-modal__actions">
          <button
            type="button"
            className="button button--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            {STR.views.corrections.cancel}
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={handleSave}
            disabled={busy}
          >
            {STR.views.corrections.save}
          </button>
        </div>
      </div>
    </div>
  );
}
