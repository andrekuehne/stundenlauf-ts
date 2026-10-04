import type { useRegisterSW as RegisterSW } from "virtual:pwa-register/react";

export const useRegisterSW: typeof RegisterSW = () => {
  throw new Error("Mock virtual:pwa-register/react explicitly when testing PWA components.");
};
