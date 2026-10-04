/** The production Pages subpath, shared by the server and browser tests. */
export const APP_BASE_PATH = process.env.VITE_BASE_PATH ?? "/stundenlauf-ts/";
export const SMOKE_HOST = "127.0.0.1";
export const SMOKE_PORT = 4174;
export const SMOKE_ORIGIN = `http://${SMOKE_HOST}:${SMOKE_PORT}`;
export const BUILD_VERSIONS = { a: "smoke-build-a", b: "smoke-build-b" } as const;
