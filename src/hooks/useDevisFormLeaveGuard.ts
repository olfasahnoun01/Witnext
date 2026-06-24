import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type LeaveAction = () => void;

interface UseDevisFormLeaveGuardOptions {
  enabled: boolean;
  onBeforeLeave?: () => void;
}

export function useDevisFormLeaveGuard({ enabled, onBeforeLeave }: UseDevisFormLeaveGuardOptions) {
  const location = useLocation();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingActionRef = useRef<LeaveAction | null>(null);
  const allowNavigationRef = useRef(false);
  const lastPathRef = useRef(location.pathname);

  const runPendingAction = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setDialogOpen(false);
    if (action) action();
  }, []);

  const requestLeave = useCallback(
    (action: LeaveAction) => {
      if (!enabled) {
        action();
        return;
      }
      pendingActionRef.current = action;
      setDialogOpen(true);
    },
    [enabled]
  );

  const cancelLeave = useCallback(() => {
    pendingActionRef.current = null;
    setDialogOpen(false);
  }, []);

  const confirmLeave = useCallback(() => {
    onBeforeLeave?.();
    runPendingAction();
  }, [onBeforeLeave, runPendingAction]);

  const allowNextNavigation = useCallback((action: LeaveAction) => {
    allowNavigationRef.current = true;
    action();
  }, []);

  useEffect(() => {
    if (!enabled) {
      lastPathRef.current = location.pathname;
      return;
    }

    if (allowNavigationRef.current) {
      allowNavigationRef.current = false;
      lastPathRef.current = location.pathname;
      return;
    }

    if (location.pathname === lastPathRef.current) return;

    const targetPath = location.pathname;
    navigate(lastPathRef.current, { replace: true });
    pendingActionRef.current = () => {
      allowNavigationRef.current = true;
      navigate(targetPath);
    };
    setDialogOpen(true);
  }, [enabled, location.pathname, navigate]);

  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      onBeforeLeave?.();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, onBeforeLeave]);

  return {
    dialogOpen,
    setDialogOpen,
    requestLeave,
    cancelLeave,
    confirmLeave,
    allowNextNavigation,
  };
}
