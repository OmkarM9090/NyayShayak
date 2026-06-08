import mongoose from "mongoose";

const AnalysisSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        sessionId: { type: String, required: true },
        role: { type: String, enum: ["user", "assistant"] },
        fileName: { type: String },
        // Yahan hum encrypted masked text store karenge
        encryptedContent: { type: String, required: true },
        maskingSummary: { type: Object }
    },
    { timestamps: true }
);

AnalysisSchema.index({ userId: 1, sessionId: 1, createdAt: -1 });

export default mongoose.model('Analysis', AnalysisSchema);