import { rankName, t } from '@pescuit/shared';
import { useGame } from '../state/store.js';

export function useT() {
  const { locale } = useGame();
  return {
    locale,
    t: (key: string, params?: Record<string, string | number>) => t(locale, key, params),
    rank: (rank: string) => rankName(rank, locale),
  };
}
