import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import { presenter } from '../game/presenter.js';

/**
 * Binds a table to the page's presenter: after every render the masks are re-applied to whatever React
 * just redrew (before paint), and the seat whose turn the table has *shown* is returned. Logic and
 * input read the view the instant it arrives; the chrome (top bar, dock, the ochre chip) follows the
 * totem, so "your turn" lands on every channel together (§4.5).
 */
export function usePresenter(playerId: string | null, currentPlayerId: string | null | undefined): string | null {
  useLayoutEffect(() => {
    presenter.afterRender();
  });
  useEffect(() => {
    presenter.setSelf(playerId);
  }, [playerId]);
  const shown = useSyncExternalStore(presenter.subscribe, presenter.getPresented);
  return shown ?? currentPlayerId ?? null;
}
