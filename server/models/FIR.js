import mongoose from "mongoose";

const FirSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sessionId: { type: String, required: true },
    encryptedContent: { type: String, required: true }
  },
  { timestamps: true }
);

FirSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("FIR", FirSchema);
