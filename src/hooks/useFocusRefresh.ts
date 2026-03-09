import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Calls the provided callback whenever:
 * 1. The route changes to the current page (React Router navigation)
 * 2. The browser tab regains focus (visibilitychange)
 * 
 * This ensures data is always fresh when a user navigates to/returns to a page.
 */
export const useFocusRefresh = (callback: () => void) => {
  const location = useLocation();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Re-run on route change
  useEffect(() => {
    callbackRef.current();
  }, [location.pathname]);

  // Re-run on tab visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        callbackRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
};
