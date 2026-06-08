import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        sessionId: { type: String, required: true },
        role: { type: String, enum: ["user", "assistant"], required: true },
        encryptedContent: { type: String, required: true }
    },
    { timestamps: true }
);

MessageSchema.index({ userId: 1, sessionId: 1, createdAt: -1 });

export default mongoose.model('Message', MessageSchema);
