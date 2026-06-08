import express from "express";
import { generateFir, getFirHistory } from "../controllers/firController.js";
import { optionalProtect, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/generate-fir", optionalProtect, generateFir);
router.get("/fir/history", protect, getFirHistory);

export default router;
