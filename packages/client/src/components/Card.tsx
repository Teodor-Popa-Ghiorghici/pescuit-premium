import type { Rank } from '@pescuit/engine';
import { POWER_RANKS } from '@pescuit/engine';
import { useT } from '../i18n/useT.js';

const POWER_SET = new Set<string>(POWER_RANKS as readonly string[]);

function categoryOf(rank: Rank): 'power' | 'normal' | 'eggs' {
  if (rank === 'eggs') return 'eggs';
  return POWER_SET.has(rank) ? 'power' : 'normal';
}

export function Card({ rank, small, faceDown }: { rank: Rank | null; small?: boolean; faceDown?: boolean }) {
  const { rank: rankLabel } = useT();
  if (faceDown || rank === null) {
    return <div className={`card card--facedown ${small ? 'card--small' : ''}`} aria-label="hidden card" />;
  }
  const cat = categoryOf(rank);
  return (
    <div className={`card card--${cat} ${small ? 'card--small' : ''}`}>
      <span className="card__label">{rankLabel(rank)}</span>
    </div>
  );
}
