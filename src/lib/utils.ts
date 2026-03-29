
export const getBaseUrl = () => {
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  
  // App-specific routes to strip from the end of the pathname
  const appRoutes = ['/assessment', '/game', '/dashboard', '/library', '/profile', '/games', '/notifications', '/feedback'];
  
  let basePath = pathname;
  
  // Sort routes by length descending to match longest first (e.g., /assessment_results vs /assessment)
  const sortedRoutes = [...appRoutes].sort((a, b) => b.length - a.length);
  
  for (const route of sortedRoutes) {
    if (basePath.includes(route)) {
      basePath = basePath.split(route)[0];
      break; // Only strip the first matching route from the right
    }
  }
  
  // Ensure it ends with a slash
  if (!basePath.endsWith('/')) {
    basePath += '/';
  }
  
  // Remove double slashes
  const fullUrl = (origin + basePath).replace(/([^:]\/)\/+/g, "$1");
  
  return fullUrl;
};

export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text);
  } catch (e) {
    try {
      // Clean like cleanJsonContent
      let cleaned = text.replace(/```json\n?|```/g, '').trim();
      if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
        const firstBrace = cleaned.indexOf('{');
        const firstBracket = cleaned.indexOf('[');
        let startIndex = -1;
        if (firstBrace !== -1 && firstBracket !== -1) {
          startIndex = Math.min(firstBrace, firstBracket);
        } else {
          startIndex = firstBrace !== -1 ? firstBrace : firstBracket;
        }
        if (startIndex !== -1) {
          cleaned = cleaned.slice(startIndex);
        }
      }
      return JSON.parse(cleaned);
    } catch (err) {
      console.error("JSON Parse Error:", err, "Original Text:", text);
      return fallback;
    }
  }
}
