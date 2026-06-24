import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPathForSubsection } from '@/config/routes';

/**
 * Navigate by legacy subsection id (notifications, devis helper, transactions, etc.).
 */
export function useSubsectionNavigate() {
  const navigate = useNavigate();

  const navigateToSubsection = useCallback(
    (subsectionId: string) => {
      navigate(getPathForSubsection(subsectionId));
    },
    [navigate]
  );

  return { navigateToSubsection };
}
