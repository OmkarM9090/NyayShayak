import express from "express";
import cors from "cors";
import documentRoutes from "../../routes/documentRoutes.js";
import authRoutes from "../../routes/authRoutes.js";
import chatRoutes from "../../routes/chatRoutes.js";
import firRoutes from "../../routes/firRoutes.js";
import { rateLimit } from "../../middleware/rateLimit.js";

export function createTestApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api/document", rateLimit, documentRoutes);
  app.use("/api/generate-fir", rateLimit);
  app.use("/api", firRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/chat", rateLimit, chatRoutes);

  return app;
}
