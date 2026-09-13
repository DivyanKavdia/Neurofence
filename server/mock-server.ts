import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { extname, resolve } from "node:path";
import { MockBackend, Store } from "../src/backend";
import {
  ApiError,
  initialSession,
  Request,
  Role,
  roles,
  State,
} from "../src/types";

// Local development only: X-Demo-* headers are intentionally NOT authentication.
// This server binds loopback and shares the exact browser mock handlers.
const root = resolve(process.env.NF_WEB_ROOT || "."),
  storeDir = resolve(process.env.NF_MOCK_DATA || ".runtime/data");
mkdirSync(storeDir, { recursive: true });
class FileStore implements Store {
  private path(key: string) {
    if (!/^[a-zA-Z0-9:_-]+$/.test(key))
      throw new ApiError(400, "INVALID_CONTEXT", "Invalid workspace context.");
    return resolve(storeDir, key.replace(":", "-") + ".json");
  }
  read(key: string) {
    const file = this.path(key);
    return existsSync(file)
      ? (JSON.parse(readFileSync(file, "utf8")) as State)
      : undefined;
  }
  write(key: string, state: State) {
    const file = this.path(key);
    writeFileSync(file + ".tmp", JSON.stringify(state));
    renameSync(file + ".tmp", file);
  }
}
const backend = new MockBackend(new FileStore(), 0);
const mime: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".jpg": "image/jpeg",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host)
        throw new ApiError(
          403,
          "ORIGIN_DENIED",
          "Use the mock console from this server origin.",
        );
      const role = String(
        req.headers["x-demo-role"] || initialSession.role,
      ) as Role;
      if (!roles.includes(role))
        throw new ApiError(400, "INVALID_ROLE", "Unknown demo role.");
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1_000_000)
          throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request exceeds 1 MB.");
        chunks.push(chunk);
      }
      backend.setSession({
        ...initialSession,
        tenant: String(req.headers["x-demo-tenant"] || "acme"),
        environment: String(req.headers["x-demo-environment"] || "Development"),
        role,
        user: String(req.headers["x-demo-user"] || initialSession.user),
      });
      const request: Request = {
        method: req.method as Request["method"],
        path: url.pathname + url.search,
        body: size ? JSON.parse(Buffer.concat(chunks).toString()) : undefined,
        version:
          req.headers["if-match"] === undefined
            ? undefined
            : Number(req.headers["if-match"]),
        idempotencyKey: String(req.headers["idempotency-key"] || ""),
      };
      const result = await backend.request(request);
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(result));
      return;
    }
    if (url.pathname === "/config.js") {
      res.writeHead(200, {
        "Content-Type": "text/javascript",
        "Cache-Control": "no-store",
      });
      res.end("window.NEURALFENCE_CONFIG={mode:'http',apiBase:''};");
      return;
    }
    const file = resolve(
      root,
      "." +
        (url.pathname === "/"
          ? "/index.html"
          : decodeURIComponent(url.pathname)),
    );
    if (
      !file.startsWith(root + "/") ||
      ![".html", ".js", ".css", ".svg", ".woff", ".jpg"].includes(extname(file))
    )
      throw new ApiError(404, "NOT_FOUND", "File not found.");
    // Only public frontend artifacts are served; sources and mock database files stay private.
    if (
      file !== resolve(root, "index.html") &&
      !file.startsWith(resolve(root, "assets") + "/")
    )
      throw new ApiError(404, "NOT_FOUND", "File not found.");
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
    });
    res.end(readFileSync(file));
  } catch (error) {
    const err =
      error instanceof ApiError
        ? error
        : new ApiError(
            400,
            "BAD_REQUEST",
            error instanceof SyntaxError
              ? "Invalid JSON request."
              : "The request could not be processed.",
          );
    res.writeHead(err.status, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: {
          code: err.code,
          message: err.message,
          retryable: err.retryable,
          correlationId: err.correlationId,
        },
      }),
    );
  }
}).listen(
  Number(process.env.PORT || 8080),
  process.env.NF_MOCK_BIND || "127.0.0.1",
  () =>
    console.log(
      "Mock control API and console: http://127.0.0.1:" +
        (process.env.PORT || 8080),
    ),
);
