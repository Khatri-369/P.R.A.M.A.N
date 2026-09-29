import express from "express";
import helmet from "helmet";
import cors from "cors";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/authRoutes.js";
import evidenceRoutes from "./routes/evidenceRoutes.js";
import custodyRoutes from "./routes/custodyRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { stats } from "./controllers/dashboardController.js";
import { auth } from "./middleware/authMiddleware.js";
import { roles } from "./middleware/roleMiddleware.js";
import { errorHandler } from "./middleware/errorMiddleware.js";
export function createApp() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error("JWT_SECRET must be at least 32 characters.");
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5000" }));
  app.use(express.json({ limit: "32kb" }));
  app.use("/api/auth", authRoutes);
  app.use("/api", auth);
  app.use("/api/evidence", evidenceRoutes);
  app.use("/api/custody", custodyRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/audit", roles("admin"), auditRoutes);
  app.get("/api/dashboard/stats", stats);
  app.use("/api", (req, res) =>
    res.status(404).json({ success: false, message: "API route not found." }),
  );
  app.use(
    express.static(fileURLToPath(new URL("../frontend/", import.meta.url))),
  );
  app.use((req, res) =>
    res.status(404).json({ success: false, message: "Page not found." }),
  );
  app.use(errorHandler);
  return app;
}
