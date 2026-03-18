const PII_PATTERNS = {
  credit_card: {
    // Visa, MC, Amex patterns with optional dashes/spaces
    regex: /\b(?:4[0-9]{3}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}|5[1-5][0-9]{2}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}|3[47][0-9]{2}[-\s]?[0-9]{6}[-\s]?[0-9]{5})\b/g,
    mask: (match) => {
      const digits = match.replace(/[-\s]/g, '');
      const last4 = digits.slice(-4);
      return `****-****-****-${last4}`;
    },
  },
  ssn: {
    regex: /\b[0-9]{3}[-\s]?[0-9]{2}[-\s]?[0-9]{4}\b/g,
    mask: (match) => {
      const digits = match.replace(/[-\s]/g, '');
      const last4 = digits.slice(-4);
      return `***-**-${last4}`;
    },
  },
  phone: {
    // US formats: (123) 456-7890, 123-456-7890, +1-123-456-7890
    // JP formats: 090-1234-5678, +81-90-1234-5678, 03-1234-5678
    regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?81[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{4}|0\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{4}/g,
    mask: (match) => {
      const digits = match.replace(/[^\d]/g, '');
      const last4 = digits.slice(-4);
      return `***-***-${last4}`;
    },
  },
  email: {
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    mask: (match) => {
      const [local, domain] = match.split('@');
      const maskedLocal = local[0] + '***';
      return `${maskedLocal}@${domain}`;
    },
  },
  api_key: {
    // Patterns like sk-..., key-..., api_key_..., Bearer tokens
    regex: /\b(?:sk-[A-Za-z0-9]{20,}|key-[A-Za-z0-9]{20,}|api[_-]key[_-][A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xox[bporas]-[A-Za-z0-9-]{10,})\b/g,
    mask: (match) => {
      const prefix = match.slice(0, 4);
      const last4 = match.slice(-4);
      return `${prefix}****${last4}`;
    },
  },
  my_number: {
    // Japanese マイナンバー (Individual Number): 12 digits, optionally grouped as 4-4-4
    regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
    mask: (match) => {
      const digits = match.replace(/\s/g, '');
      const last4 = digits.slice(-4);
      return `****-****-${last4}`;
    },
  },
};

/**
 * Detect PII in text and return an array of findings.
 * Each finding has: { type, masked, start, end }
 */
export function detectPII(text) {
  if (!text || typeof text !== 'string') return [];

  const findings = [];

  for (const [type, { regex, mask }] of Object.entries(PII_PATTERNS)) {
    // Reset regex lastIndex for global patterns
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      findings.push({
        type,
        masked: mask(match[0]),
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Sort by start position
  findings.sort((a, b) => a.start - b.start);
  return findings;
}

/**
 * Mask all PII in text, replacing detected patterns with masked versions.
 */
/**
 * Scan text for PII. Returns { hasPII, findings }.
 * Each finding: { type, value (masked), position }
 */
export function scan(text) {
  const findings = detectPII(text);
  return {
    hasPII: findings.length > 0,
    findings: findings.map(f => ({
      type: f.type,
      value: f.masked,
      position: f.start,
    })),
  };
}

/**
 * Alias for maskPII — matches spec's mask() signature.
 */
export function mask(text) {
  return maskPII(text);
}

export function maskPII(text) {
  if (!text || typeof text !== 'string') return text;

  const findings = detectPII(text);
  if (findings.length === 0) return text;

  // Process replacements from end to start to preserve positions
  let result = text;
  for (let i = findings.length - 1; i >= 0; i--) {
    const { masked, start, end } = findings[i];
    result = result.slice(0, start) + masked + result.slice(end);
  }

  return result;
}
