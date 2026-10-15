import { useEffect, useRef } from 'react';
// Capture at operation start. Prevent external side effects after an account unmounts.
export function useOperationLifetime() {
  const lifetime = useRef(0);
  useEffect(() => {
    const epoch = lifetime.current;
    return () => {
      lifetime.current = epoch + 1;
    };
  }, []);
  return () => {
    const epoch = lifetime.current;
    return () => epoch === lifetime.current;
  };
}
