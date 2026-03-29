
/**
 * Safely parse JSON from AI responses, handling common issues like
 * markdown blocks, missing array brackets, missing commas, and truncated responses.
 */
export const safeJsonParse = (text: string, fallback: any = null) => {
  if (!text) return fallback;
  
  // Helper to fix truncated JSON by closing open brackets/braces
  const repairTruncatedJson = (jsonStr: string): string => {
    let stack: string[] = [];
    let inString = false;
    let escaped = false;

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') stack.push('}');
        if (char === '[') stack.push(']');
        if (char === '}' || char === ']') {
          if (stack.length > 0 && stack[stack.length - 1] === char) {
            stack.pop();
          }
        }
      }
    }

    let repaired = jsonStr;
    if (inString) repaired += '"';
    
    // If we ended with a comma, remove it
    repaired = repaired.trim();
    if (repaired.endsWith(',')) {
      repaired = repaired.slice(0, -1);
    }

    // Close open objects and arrays in reverse order
    while (stack.length > 0) {
      repaired += stack.pop();
    }

    return repaired;
  };

  const tryParse = (jsonStr: string) => {
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      // Try repairing if it looks truncated
      try {
        const repaired = repairTruncatedJson(jsonStr);
        return JSON.parse(repaired);
      } catch (e2) {
        return null;
      }
    }
  };

  // 1. Clean markdown blocks and fix common AI formatting errors
  let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  // Fix trailing decimal points (e.g. 1. -> 1.0) which cause JSON.parse to fail
  cleanText = cleanText.replace(/(\d+)\.(?!\d)/g, '$1.0');
  
  // 2. Try direct parse
  let result = tryParse(cleanText);
  if (result !== null) return result;

  // 3. Try to extract JSON using regex
  // Find the first [ or { and the last ] or }
  const firstBracket = cleanText.indexOf('[');
  const firstBrace = cleanText.indexOf('{');
  const lastBracket = cleanText.lastIndexOf(']');
  const lastBrace = cleanText.lastIndexOf('}');

  let start = -1;
  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    start = firstBracket;
  } else if (firstBrace !== -1) {
    start = firstBrace;
  }

  if (start !== -1) {
    // Try extracting from start to the end of the string (in case it's truncated)
    const extracted = cleanText.substring(start);
    result = tryParse(extracted);
    if (result !== null) return result;

    // Try extracting from start to the last matching end character
    let end = -1;
    if (cleanText[start] === '[') {
      end = lastBracket;
    } else {
      end = lastBrace;
    }

    if (end !== -1 && end > start) {
      const extractedFixed = cleanText.substring(start, end + 1);
      result = tryParse(extractedFixed);
      if (result !== null) return result;
    }
  }

  // 4. Handle the specific case: starts with array but has object properties after it
  // e.g. [ ... ], "key": "value" -> { "data": [ ... ], "key": "value" }
  if (cleanText.startsWith('[') && cleanText.includes('],')) {
    try {
      const wrapped = `{ "items": ${cleanText} }`;
      result = tryParse(wrapped);
      if (result !== null) return result;
      
      // Or maybe it just missed the opening {
      const withBrace = `{ ${cleanText} }`;
      result = tryParse(withBrace);
      if (result !== null) return result;
    } catch (e) {}
  }

  // 5. Handle common AI formatting errors:
  // - Missing array brackets: {"a":1}, {"b":2}
  // - Missing commas: {"a":1} {"b":2}
  const withCommas = cleanText.replace(/\}\s*\{/g, '},{');
  if (withCommas !== cleanText) {
    result = tryParse(`[${withCommas}]`);
    if (result !== null) return result;
  }

  console.error("Failed to parse extracted JSON:", text.substring(0, 100) + "...");
  return fallback;
};
