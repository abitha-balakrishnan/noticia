/**
 * Noticia SIEM - Strict MongoDB Query Validator (Mandatory RAG Safety Gate)
 * Enforces field allow-listing, date-range sanity checks, and blocks injection attacks.
 */

const ALLOWED_FIELDS = new Set([
  'ip',
  'username',
  'status',
  'endpoint',
  'timestamp',
  'statusCode',
  'method'
]);

const ALLOWED_OPERATORS = new Set([
  '$gte',
  '$lte',
  '$gt',
  '$lt',
  '$eq',
  '$ne',
  '$in',
  '$regex',
  '$options',
  '$or',
  '$and'
]);

const FORBIDDEN_OPERATORS = new Set([
  '$where',
  '$accumulator',
  '$function',
  '$expr',
  '$rename',
  '$unset',
  'eval',
  '__proto__',
  'constructor'
]);

function isObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date);
}

function isValidDate(d) {
  if (d instanceof Date) return !isNaN(d.getTime());
  if (typeof d === 'string' || typeof d === 'number') {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return false;
    const year = parsed.getFullYear();
    // Sanity range check: reject absurd years (e.g. year 1900 or 3000)
    return year >= 2000 && year <= 2100;
  }
  return false;
}

/**
 * Validates and sanitizes a parsed JSON query object from LLM
 */
function validateQuery(queryObj) {
  if (!queryObj || typeof queryObj !== 'object' || Array.isArray(queryObj)) {
    return {
      isValid: false,
      reason: 'Generated query must be a valid JSON object'
    };
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(queryObj)) {
    // Check forbidden operators
    if (FORBIDDEN_OPERATORS.has(key)) {
      return {
        isValid: false,
        reason: `Forbidden operator detected: "${key}"`
      };
    }

    // Handle Logical $or and $and
    if (key === '$or' || key === '$and') {
      if (!Array.isArray(value)) {
        return {
          isValid: false,
          reason: `Operator "${key}" must be an array of sub-filters`
        };
      }
      const subQueries = [];
      for (const item of value) {
        const subValidation = validateQuery(item);
        if (!subValidation.isValid) {
          return subValidation;
        }
        subQueries.push(subValidation.sanitizedQuery);
      }
      sanitized[key] = subQueries;
      continue;
    }

    // Allow-list check for field names
    if (!ALLOWED_FIELDS.has(key)) {
      return {
        isValid: false,
        reason: `Disallowed field "${key}". Only allowed fields are: ${Array.from(ALLOWED_FIELDS).join(', ')}`
      };
    }

    // Validate field conditions
    if (isObject(value)) {
      const sanitizedCondition = {};
      for (const [op, opVal] of Object.entries(value)) {
        if (FORBIDDEN_OPERATORS.has(op)) {
          return {
            isValid: false,
            reason: `Forbidden operator "${op}" detected on field "${key}"`
          };
        }
        if (!ALLOWED_OPERATORS.has(op)) {
          return {
            isValid: false,
            reason: `Disallowed operator "${op}" on field "${key}"`
          };
        }

        // Date validation for timestamp field
        if (key === 'timestamp' && (op === '$gte' || op === '$lte' || op === '$gt' || op === '$lt' || op === '$eq')) {
          if (!isValidDate(opVal)) {
            return {
              isValid: false,
              reason: `Malformed or absurd date range in timestamp condition: "${opVal}"`
            };
          }
          sanitizedCondition[op] = new Date(opVal);
        } else if (op === '$regex') {
          // Reject excessively long or dangerous regex patterns (ReDoS prevention)
          if (typeof opVal !== 'string' || opVal.length > 80 || /([*+?]){3,}/.test(opVal)) {
            return {
              isValid: false,
              reason: `Invalid or unsafe regex pattern on field "${key}"`
            };
          }
          sanitizedCondition[op] = opVal;
        } else {
          sanitizedCondition[op] = opVal;
        }
      }
      sanitized[key] = sanitizedCondition;
    } else {
      // Direct value condition
      if (key === 'timestamp') {
        if (!isValidDate(value)) {
          return {
            isValid: false,
            reason: `Malformed date value for timestamp: "${value}"`
          };
        }
        sanitized[key] = new Date(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return {
    isValid: true,
    sanitizedQuery: sanitized
  };
}

module.exports = {
  validateQuery,
  ALLOWED_FIELDS,
  ALLOWED_OPERATORS,
  FORBIDDEN_OPERATORS
};
