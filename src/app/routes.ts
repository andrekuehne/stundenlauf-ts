export const APP_ROUTES = [
  "season",
  "standings",
  "import",
  "corrections",
  "history",
] as const;

export type AppRoute = (typeof APP_ROUTES)[number];

export function isAppRoute(value: string): value is AppRoute {
  return APP_ROUTES.includes(value as AppRoute);
}
