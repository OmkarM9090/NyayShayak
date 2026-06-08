import express from "express";
import multer from "multer";
import { analyseImage } from "../controllers/ocrController.js";

const router = express.Router();

const upload = multer({
  dest: "uploads/images/"
});

router.post("/analyse-image", upload.single("file"), analyseImage);

export default router;