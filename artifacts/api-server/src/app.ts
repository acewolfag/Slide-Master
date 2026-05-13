import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);

const corsOriginsEnv = process.env.CORS_ORIGINS?.trim();
const corsOrigins = corsOriginsEnv ? corsOriginsEnv.split(",").map((s) => s.trim()).filter(Boolean) : [];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (corsOrigins.length === 0) {
        cb(null, true);
        return;
      }
      if (corsOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error(`CORS rejected origin: ${origin}`));
    },
    credentials: true,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

const loginLimit = Number(process.env.RATE_LIMIT_LOGIN_PER_15MIN ?? 10);
const resetLimit = Number(process.env.RATE_LIMIT_RESET_PER_HOUR ?? 5);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: loginLimit,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Quá nhiều lần thử đăng nhập, vui lòng thử lại sau 15 phút" },
});
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: resetLimit,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Quá nhiều yêu cầu đặt lại mật khẩu, vui lòng thử lại sau 1 giờ" },
});

const guestUploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Quá nhiều lần upload, vui lòng thử lại sau" },
});

app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/reset-password", resetLimiter);
app.use("/api/upload-attachment", guestUploadLimiter);
app.use("/api/admin/users", (req, res, next) => {
  if (req.path.endsWith("/send-reset-link") && req.method === "POST") {
    return resetLimiter(req, res, next);
  }
  return next();
});

app.use("/api/uploads", express.static(path.resolve(__dirname, "../../uploads")));

app.use("/api", router);

// 404 for unmatched /api routes
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Final error handler — never leak stack traces or internal paths
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const isProd = process.env.NODE_ENV === "production";
  const errMsg = err instanceof Error ? err.message : String(err);
  logger.error({ err, url: req.url, method: req.method }, "Unhandled error");
  if (res.headersSent) return;
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { statusCode?: number })?.statusCode
    ?? 500;
  if (isProd) {
    res.status(status).json({
      error: status >= 500 ? "Internal server error" : errMsg.split("\n")[0].slice(0, 200),
    });
  } else {
    res.status(status).json({ error: errMsg.split("\n")[0].slice(0, 500) });
  }
});

export default app;
