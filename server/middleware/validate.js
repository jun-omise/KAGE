/**
 * リクエストボディのバリデーション
 * @param {Object} schema - { fieldName: { type, required, maxLength, min, max } }
 */
export function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} は必須です`);
        continue;
      }

      if (value !== undefined && value !== null) {
        if (rules.type === 'string' && typeof value !== 'string') {
          errors.push(`${field} は文字列である必要があります`);
        }
        if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
          errors.push(`${field} は${rules.maxLength}文字以内にしてください`);
        }
        if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
          errors.push(`${field} は${rules.minLength}文字以上にしてください`);
        }
        if (rules.type === 'number' && typeof value !== 'number') {
          errors.push(`${field} は数値である必要があります`);
        }
        if (rules.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`${field} は真偽値である必要があります`);
        }
        if (typeof rules.min === 'number' && typeof value === 'number' && value < rules.min) {
          errors.push(`${field} は${rules.min}以上にしてください`);
        }
        if (typeof rules.max === 'number' && typeof value === 'number' && value > rules.max) {
          errors.push(`${field} は${rules.max}以下にしてください`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(', ') });
    }

    next();
  };
}
