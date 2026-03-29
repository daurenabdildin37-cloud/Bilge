import { useAuth as useAuthContext } from '../contexts/AuthContext';

/**
 * useAuth hook that consumes the AuthContext.
 * This ensures that all components share the same authentication state
 * and prevents multiple auth listeners from being created.
 */
export function useAuth() {
  return useAuthContext();
}
