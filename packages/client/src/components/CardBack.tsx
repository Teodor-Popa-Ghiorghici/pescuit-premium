import { memo } from 'react';
import { BAKED_BACK } from '../art/baked-back.generated.js';

/** §4.4 — one back, one seed, byte-identical wherever it is drawn (the ink bake gives it ONE fixed seed, never a rank's).
 *  Its own module so the lobby can draw it without the faces. */
function CardBackImpl({ width = 88, height = 132, title }: { width?: number; height?: number; title?: string }) {
  return (
    <div className="card card--back" title={title} role="img" aria-label={title ?? 'card'}>
      <svg className="card__plate" width={width} height={height} viewBox="0 0 264 396" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: BAKED_BACK }} />
    </div>
  );
}

export const CardBack = memo(CardBackImpl);
