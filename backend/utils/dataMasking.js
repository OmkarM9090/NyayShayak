// utils/dataMasking.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATA MASKING UTILITY - Privacy Protection for Legal Documents
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Purpose: Mask sensitive information before sending to external APIs
// Protects: Aadhaar, PAN, Phone Numbers, Email, Names, Addresses
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Regex patterns to detect sensitive information in Indian legal documents
 * All patterns are case-insensitive and global (match all occurrences)
 */
const SENSITIVE_DATA_PATTERNS = {
  // Aadhaar Number: 1234-5678-9012 or 123456789012
  // Format: 12 digits with optional hyphens or spaces
  aadhaar: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/gi,

  // PAN Card: ABCDE1234F
  // Format: 5 letters, 4 digits, 1 letter (uppercase)
  pan: /\b[A-Z]{5}\d{4}[A-Z]\b/gi,

  // Indian Mobile Numbers: 9876543210
  // Format: 10 digits starting with 6-9
  phone: /\b[6-9]\d{9}\b/g,

  // Email Addresses: user@example.com
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi,

  // Passport Number: A1234567 (simple pattern)
  passport: /\b[A-Z]\d{7}\b/g,

  // Driving License: Various formats (simple pattern)
  drivingLicense: /\b[A-Z]{2}[-]?\d{2}[-]?\d{4}[-]?\d{7}\b/gi,

  // Bank Account Number: 8-18 digits
  bankAccount: /\b\d{8,18}\b/g,

  // IFSC Code: ABCD0123456
  ifsc: /\b[A-Z]{4}0[A-Z0-9]{6}\b/gi,

  // Credit Card: 4 groups of 4 digits
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
};

/**
 * Common Indian names database (for basic name detection)
 * This is a simplified list - can be expanded with NER models in production
 */
const COMMON_INDIAN_NAMES = [
  // Common first names
  "Amit", "Raj", "Priya", "Rahul", "Neha", "Sanjay", "Deepak", "Kavita",
  "Vikram", "Anjali", "Arjun", "Pooja", "Ravi", "Sneha", "Kumar", "Sharma",
  "Singh", "Patel", "Gupta", "Reddy", "Mehta", "Shah", "Jain",
  // Add more as needed
];

/**
 * Create regex pattern for name detection
 * Matches: "Rajesh Kumar" or "Priya Sharma" (First Last format)
 */
const createNamePattern = () => {
  // Simple pattern: Capital letter followed by lowercase, space, repeat
  return /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g;
};

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * MAIN MASKING FUNCTION
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

/**
 * Mask all sensitive information in document text
 * 
 * @param {string} text - Original document text
 * @returns {object} - {
 *   maskedText: string,        // Text with placeholders
 *   replacements: array,       // Array of {type, original, placeholder}
 *   hasSensitiveData: boolean, // True if any data was masked
 *   summary: object            // Count of each data type masked
 * }
 * 
 * @example
 * Input:  "Contact Rajesh Kumar at rajesh@email.com or 9876543210"
 * Output: "Contact [NAME_1] at [EMAIL_1] or [PHONE_1]"
 */
export function maskSensitiveData(text) {
  // Validate input
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return {
      maskedText: '',
      replacements: [],
      hasSensitiveData: false,
      summary: {}
    };
  }

  let maskedText = text;
  const replacements = [];
  const summary = {};

  /**
   * Helper function to mask data by type
   * @param {string} type - Data type (e.g., 'aadhaar', 'phone')
   * @param {RegExp} pattern - Regex pattern to find data
   * @param {string} label - Label for placeholder (e.g., 'AADHAAR', 'PHONE')
   */
  const maskDataByType = (type, pattern, label) => {
    let counter = 1;
    const matches = [...text.matchAll(pattern)];

    if (matches.length > 0) {
      summary[type] = matches.length;
    }

    matches.forEach((match) => {
      const original = match[0];
      const placeholder = `[${label}_${counter}]`;
      
      // Replace in masked text
      maskedText = maskedText.replace(original, placeholder);
      
      // Store replacement info
      replacements.push({
        type: type,
        original: original,
        placeholder: placeholder,
        position: match.index
      });
      
      counter++;
    });
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MASKING SEQUENCE (Order matters! Mask longer patterns first)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // 1. Mask Credit Cards (must be before bank accounts to avoid conflicts)
  maskDataByType('creditCard', SENSITIVE_DATA_PATTERNS.creditCard, 'CREDIT_CARD');

  // 2. Mask Aadhaar Numbers
  maskDataByType('aadhaar', SENSITIVE_DATA_PATTERNS.aadhaar, 'AADHAAR');

  // 3. Mask PAN Cards
  maskDataByType('pan', SENSITIVE_DATA_PATTERNS.pan, 'PAN');

  // 4. Mask Passport Numbers
  maskDataByType('passport', SENSITIVE_DATA_PATTERNS.passport, 'PASSPORT');

  // 5. Mask Driving Licenses
  maskDataByType('drivingLicense', SENSITIVE_DATA_PATTERNS.drivingLicense, 'DL');

  // 6. Mask IFSC Codes
  maskDataByType('ifsc', SENSITIVE_DATA_PATTERNS.ifsc, 'IFSC');

  // 7. Mask Bank Account Numbers
  maskDataByType('bankAccount', SENSITIVE_DATA_PATTERNS.bankAccount, 'BANK_ACCOUNT');

  // 8. Mask Phone Numbers
  maskDataByType('phone', SENSITIVE_DATA_PATTERNS.phone, 'PHONE');

  // 9. Mask Email Addresses
  maskDataByType('email', SENSITIVE_DATA_PATTERNS.email, 'EMAIL');

  // 10. Mask Names (Last - to avoid masking legal terms)
  maskDataByType('name', createNamePattern(), 'NAME');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PREPARE RESPONSE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const result = {
    maskedText: maskedText,
    replacements: replacements,
    hasSensitiveData: replacements.length > 0,
    summary: summary,
    totalFieldsMasked: replacements.length
  };

  // Log masking summary
  if (result.hasSensitiveData) {
    console.log('[DataMasking] ✅ Masked sensitive data:', JSON.stringify(summary));
  } else {
    console.log('[DataMasking] ℹ️  No sensitive data detected');
  }

  return result;
}

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * UNMASKING FUNCTION (Optional - for restoring original values)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

/**
 * Restore original values to masked text
 * 
 * @param {string} maskedText - Text with placeholders
 * @param {array} replacements - Array from maskSensitiveData() result
 * @returns {string} - Original unmasked text
 * 
 * @example
 * Input:  "[NAME_1] lives at [EMAIL_1]"
 * Output: "Rajesh Kumar lives at rajesh@email.com"
 */
export function unmaskData(maskedText, replacements) {
  let unmaskedText = maskedText;

  // Replace each placeholder with original value
  replacements.forEach((replacement) => {
    unmaskedText = unmaskedText.replace(
      replacement.placeholder,
      replacement.original
    );
  });

  console.log('[DataMasking] ✅ Data unmasked successfully');
  return unmaskedText;
}

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * VALIDATION FUNCTIONS
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

/**
 * Check if text contains Aadhaar number
 */
export function hasAadhaar(text) {
  return SENSITIVE_DATA_PATTERNS.aadhaar.test(text);
}

/**
 * Check if text contains PAN card
 */
export function hasPAN(text) {
  return SENSITIVE_DATA_PATTERNS.pan.test(text);
}

/**
 * Check if text contains phone number
 */
export function hasPhone(text) {
  return SENSITIVE_DATA_PATTERNS.phone.test(text);
}

/**
 * Check if text contains any sensitive data
 */
export function hasSensitiveData(text) {
  return Object.values(SENSITIVE_DATA_PATTERNS).some(pattern => pattern.test(text));
}

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * EXPORT ALL FUNCTIONS
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

export default {
  maskSensitiveData,
  unmaskData,
  hasAadhaar,
  hasPAN,
  hasPhone,
  hasSensitiveData,
  SENSITIVE_DATA_PATTERNS
};
