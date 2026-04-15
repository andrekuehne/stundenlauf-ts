import { useRegisterSW } from "virtual:pwa-register/react";
import { STR } from "@/app/strings.ts";

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
      <span>{STR.update.available}</span>
      <button
        type="button"
        className="button button--primary"
        onClick={() => {
          void updateServiceWorker(true);
        }}
      >
        {STR.update.refresh}
      </button>
    </div>
  );
}
