import crypto from "crypto";
import { maskSensitiveData } from "./dataMasking.js";

const ALGORITHM = "aes-256-gcm";
const LEGACY_ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 12;
const LEGACY_IV_LENGTH = 16;
const VERSION_PREFIX = "v2";

function normalizeKey(rawKey) {
    if (!rawKey) {
        throw new Error("ENCRYPTION_KEY is not set");
    }

    const trimmed = String(rawKey).trim();
    let keyBuffer = Buffer.from(trimmed);

    if (keyBuffer.length === 32) {
        return keyBuffer;
    }

    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
        keyBuffer = Buffer.from(trimmed, "hex");
    } else if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
        keyBuffer = Buffer.from(trimmed, "base64");
    }

    if (keyBuffer.length !== 32) {
        throw new Error("ENCRYPTION_KEY must be 32 bytes for AES-256-GCM");
    }

    return keyBuffer;
}

const KEY = normalizeKey(process.env.ENCRYPTION_KEY);

export const processAndEncrypt = (rawText) => {
    // 1. Pehle Masking karein (Privacy)
    const maskingResult = maskSensitiveData(rawText);
    const maskedText = maskingResult.maskedText;

    // 2. Ab Encrypt karein (Security)
    const secureString = encryptData(maskedText);

    return {
        secureString,
        maskingSummary: maskingResult.summary
    };
};

export const encryptData = (rawText) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

    let encrypted = cipher.update(rawText, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();
    return `${VERSION_PREFIX}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
};

export const decryptData = (encryptedText) => {
    const raw = String(encryptedText || "");
    if (!raw) {
        throw new Error("Encrypted payload is empty");
    }

    if (raw.startsWith(`${VERSION_PREFIX}:`)) {
        const parts = raw.split(":");
        if (parts.length < 4) {
            throw new Error("Invalid encrypted payload format");
        }

        const iv = Buffer.from(parts[1], "hex");
        const authTag = Buffer.from(parts[2], "hex");
        const encryptedData = Buffer.from(parts.slice(3).join(":"), "hex");
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedData, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    }

    const textParts = raw.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedData = Buffer.from(textParts.join(":"), "hex");

    const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
};