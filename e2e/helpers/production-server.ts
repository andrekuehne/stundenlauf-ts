/** Test-only production server. Run with the repository's pinned Node 24. */
import { createServer, type ServerResponse } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

import { APP_BASE_PATH, BUILD_VERSIONS, SMOKE_HOST, SMOKE_PORT } from "./smoke-settings.ts";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryRoot = await mkdtemp(join(tmpdir(), "stundenlauf-production-smoke-"));
const builds = { a: join(temporaryRoot, "a"), b: join(temporaryRoot, "b") };
let activeBuild: keyof typeof builds = "a";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function respond(response: ServerResponse, status: number, message: string): void {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(message);
}

try {
  if (!/^\/[\w/-]+\/$/.test(APP_BASE_PATH)) {
    throw new Error("Production smoke requires a non-root Pages subpath with a trailing slash");
  }
  // Both outputs use the authoritative production config. Only version text differs,
  // producing an actual changed application asset and generated precache/SW revision.
  // Build sequentially; do not mutate tracked sources/configuration or shared dist.
  for (const buildName of ["a", "b"] as const) {
    await build({
      root: projectRoot,
      configFile: resolve(projectRoot, "vite.config.ts"),
      define: { __APP_VERSION__: JSON.stringify(BUILD_VERSIONS[buildName]) },
      build: { outDir: builds[buildName], emptyOutDir: true },
    });
  }
  const [firstWorker, secondWorker] = await Promise.all([
    readFile(join(builds.a, "sw.js")),
    readFile(join(builds.b, "sw.js")),
  ]);
  if (firstWorker.equals(secondWorker))
    throw new Error("Successive builds did not produce different service workers");

  const server = createServer((request, response) => {
    void (async () => {
      const pathname = decodeURIComponent(
        new URL(request.url ?? "/", `http://${SMOKE_HOST}`).pathname,
      );
      if (pathname === "/__smoke__/health" && request.method === "GET") {
        respond(response, 200, `production smoke ready: ${activeBuild}`);
        return;
      }
      if (
        request.method === "POST" &&
        (pathname === "/__smoke__/build/a" || pathname === "/__smoke__/build/b")
      ) {
        activeBuild = pathname.endsWith("/a") ? "a" : "b";
        respond(response, 200, BUILD_VERSIONS[activeBuild]);
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        respond(response, 405, "Method not allowed");
        return;
      }
      if (!pathname.startsWith(APP_BASE_PATH)) {
        respond(response, 404, "Application is served only at its Pages subpath");
        return;
      }
      const root = builds[activeBuild];
      const filename = resolve(root, pathname.slice(APP_BASE_PATH.length) || "index.html");
      const relativeFilename = relative(root, filename);
      if (
        isAbsolute(relativeFilename) ||
        relativeFilename === ".." ||
        relativeFilename.startsWith(`..${sep}`)
      ) {
        respond(response, 403, "Path is outside production output");
        return;
      }
      try {
        if (!(await stat(filename)).isFile()) {
          respond(response, 404, "Production asset not found");
          return;
        }
        const bytes = await readFile(filename);
        response.writeHead(200, {
          "Content-Type": contentTypes[extname(filename)] ?? "application/octet-stream",
          // Force actual SW update checks; Workbox still exercises its real precache.
          "Cache-Control": "no-store",
        });
        response.end(request.method === "HEAD" ? undefined : bytes);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          respond(response, 404, "Production asset not found");
          return;
        }
        throw error;
      }
    })().catch((error: unknown) => {
      console.error(error);
      if (!response.headersSent) respond(response, 500, "Production smoke server error");
      else response.destroy();
    });
  });

  await new Promise<void>((resolveListening, reject) => {
    server.once("error", reject);
    server.listen(SMOKE_PORT, SMOKE_HOST, resolveListening);
  });
  console.log(`Production smoke ready at http://${SMOKE_HOST}:${SMOKE_PORT}${APP_BASE_PATH}`);
  let stopping = false;
  async function stop(): Promise<void> {
    if (stopping) return;
    stopping = true;
    await new Promise<void>((resolveClosed) => {
      server.close(() => {
        resolveClosed();
      });
      server.closeAllConnections();
    });
    await rm(temporaryRoot, { recursive: true, force: true });
  }
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void stop()
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          console.error(error);
          process.exit(1);
        });
    });
  }
} catch (error) {
  await rm(temporaryRoot, { recursive: true, force: true });
  throw error;
}
