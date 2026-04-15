import { useRegisterSW } from "virtual:pwa-register/react";

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="update-toast" role="alert" aria-live="polite">
      <span>Neue Version verfuegbar.</span>
      <button
        type="button"
        className="button button--primary"
        onClick={() => {
          void updateServiceWorker(true);
        }}
      >
        Aktualisieren
      </button>
    </div>
  );
}
