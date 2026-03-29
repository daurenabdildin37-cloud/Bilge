
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
