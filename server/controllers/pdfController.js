import fs from "fs";
import axios from "axios";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

export const analysePDF = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF uploaded" });
    }

    const filePath = req.file.path;

    // Read PDF file
    const dataBuffer = fs.readFileSync(filePath);

    // ✅ Correct usage (NO .default)
    const pdfData = await pdf(dataBuffer);

    const extractedText = pdfData.text;

    // Detect scanned PDF
    if (!extractedText.trim()) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        error: "Scanned PDF detected. OCR required."
      });
    }

    // Limit text before sending to ML
    const limitedText = extractedText.substring(0, 30000);

    // Send to ML service
    const mlResponse = await axios.post(
      "http://localhost:5000/api/analyse",
      { text: limitedText }
    );

    // Delete uploaded file (privacy safe)
    fs.unlinkSync(filePath);

    res.json({
      pages: pdfData.numpages,
      textLength: extractedText.length,
      mlResult: mlResponse.data
    });

  } catch (error) {
    console.error("PDF Error:", error);
    res.status(500).json({ error: "PDF processing failed" });
  }
};