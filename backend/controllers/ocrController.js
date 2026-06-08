import { createWorker } from "tesseract.js";
import axios from "axios";
import fs from "fs";

export const analyseImage = async (req, res) => {
  try {
    const filePath = req.file.path;

    const worker = await createWorker("eng");

    const { data } = await worker.recognize(filePath);

    await worker.terminate();

    const extractedText = data.text;

    // CALL ML API
    const mlResponse = await axios.post("http://localhost:5000/api/analyse", {
      text: extractedText,
    });

    fs.unlinkSync(filePath);

    res.json(mlResponse.data);
    // console.log("Extracted Text:", extractedText);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "OCR failed",
    });
  }
};
