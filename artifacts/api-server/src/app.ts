import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import multer from "multer";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback-secret-change-in-prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", router);

// Global error handler — catches Multer rejections and any unhandled Express errors
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: `Upload error: ${err.message}` });
    return;
  }
  if (err instanceof Error) {
    const status = (err as any).status ?? (err as any).statusCode ?? 500;
    logger.error({ err }, "Unhandled express error");
    res.status(status).json({ error: err.message });
    return;
  }
  logger.error({ err }, "Unknown error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
