/* Layout mocks for FEEL_VISUAL_SOUND_PLAN.md §5.2–§5.3, built from the client's real
 * card art, seals, totem, clock, fonts and tokens. Frames are chosen with ?frame=:
 *   your-turn · ask-sheet · answer · chips
 * The textures are quick feTurbulence stand-ins for the §5.4 tiles, not final art. */
import type { Rank } from '@pescuit/engine';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../../packages/client/src/styles.css';
import { ArtDefs } from '../../../packages/client/src/art/defs.tsx';
import { Seal } from '../../../packages/client/src/art/seals.tsx';
import { NotchClock, Totem } from '../../../packages/client/src/art/table.tsx';
import { Card, CardBack } from '../../../packages/client/src/components/Card.tsx';
import { GameProvider } from '../../../packages/client/src/state/store.tsx';
import './mock.css';

/* ------------------------------------------------------------ player marks (§5.6) */
type MarkId = 'rozeta' | 'brad' | 'val' | 'soare' | 'funie' | 'cruce';
const MARKS: Record<MarkId, React.ReactElement> = {
  rozeta: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12,4 L12,20 M4,12 L20,12 M6.5,6.5 L17.5,17.5 M17.5,6.5 L6.5,17.5" strokeWidth="2" />
    </>
  ),
  brad: <path d="M12,2 L20,11 H15 L21,19 H3 L9,11 H4 Z M12,19 V23" />,
  val: <path d="M2,8 Q7,3 12,8 T22,8 M2,16 Q7,11 12,16 T22,16" />,
  soare: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12,1 V5 M12,19 V23 M1,12 H5 M19,12 H23 M4,4 L7,7 M17,17 L20,20 M20,4 L17,7 M7,17 L4,20" strokeWidth="2" />
    </>
  ),
  funie: <path d="M6,6 C14,6 10,18 18,18 M6,18 C14,18 10,6 18,6" />,
  cruce: <path d="M12,3 V21 M3,12 H21 M8,8 L10,10 M16,8 L14,10 M8,16 L10,14 M16,16 L14,14" />,
};

function Mark({ id, size = 12, color = 'currentColor' }: { id: MarkId; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" aria-hidden="true" style={{ flex: 'none' }}>
      {MARKS[id]}
    </svg>
  );
}

const FanIcon = () => (
  <svg width="11" height="10" viewBox="0 0 22 20" aria-hidden="true" style={{ flex: 'none' }}>
    <g fill="#40291a" stroke="#e3d3b4" strokeWidth="1.5">
      <rect x="2" y="3" width="9" height="15" transform="rotate(-14 6 10)" />
      <rect x="7" y="2" width="9" height="15" />
      <rect x="12" y="3" width="9" height="15" transform="rotate(14 16 10)" />
    </g>
  </svg>
);

/** "Gone fishing": the hook of a player who is away from the table. */
const HookIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#e8b4a8" strokeWidth="3" aria-hidden="true">
    <path d="M15,2 V14 A5.5,5.5 0 1 1 4.5,11.5 M4.5,11.5 L8,9.5" />
  </svg>
);

/** One diamond per power set: filled = unused (hidden or face-up), open = used or destroyed. */
function PowerPips({ unused, used }: { unused: number; used: number }) {
  return (
    <span className="pips-power" aria-label={`${unused} unused, ${used} used power sets`}>
      {Array.from({ length: unused }, (_, i) => (
        <svg key={`u${i}`} width="8" height="8" viewBox="0 0 8 8"><polygon points="4,0 8,4 4,8 0,4" fill="#6b7fc9" stroke="#efe2c8" strokeWidth="1" /></svg>
      ))}
      {Array.from({ length: used }, (_, i) => (
        <svg key={`s${i}`} width="8" height="8" viewBox="0 0 8 8"><polygon points="4,0.8 7.2,4 4,7.2 0.8,4" fill="none" stroke="#b9ab96" strokeWidth="1.3" /></svg>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ the chip */
interface Seat {
  name: string;
  mark: MarkId;
  score: number;
  unused: number;
  used: number;
  hand: number;
  stunned?: boolean;
  protectedRank?: boolean;
  offline?: boolean;
  current?: boolean;
}

/** Chips show the first word of a long name; the full name is on the ask sheet and in the drawer. */
function shortName(name: string): string {
  return name.length <= 8 ? name : name.split(/[\s-]/)[0];
}

function Chip({ p }: { p: Seat }) {
  const cls = ['chip', p.current && 'is-current', p.stunned && 'is-stunned', p.offline && 'is-offline', p.protectedRank && 'is-protected']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls}>
      {p.current && (
        <div className="chip__totem">
          <Totem size={14} />
        </div>
      )}
      {p.protectedRank && (
        <svg className="chip__shell" viewBox="0 0 60 12" preserveAspectRatio="none" aria-hidden="true">
          <path d="M1,11 Q30,-6 59,11 L59,12 Q30,0 1,12 Z" fill="#3d7a66" stroke="#17120e" strokeWidth="1.6" />
        </svg>
      )}
      <div className="chip__plate">{shortName(p.name)}</div>
      {p.stunned && (
        <div className="chip__brand" aria-hidden="true">
          <Seal rank="jellyfish" size={30} color="#efe2c8" />
        </div>
      )}
      <div className="chip__row">
        <Mark id={p.mark} size={12} color="#e3d3b4" />
        <span className="chip__score">{p.score}</span>
        <PowerPips unused={p.unused} used={p.used} />
      </div>
      <div className="chip__row chip__row--foot">
        <span className="chip__hand">
          <FanIcon />
          {p.hand}
        </span>
        <span className="chip__status">
          {p.stunned && <Seal rank="jellyfish" size={11} color="#e3d3b4" />}
          {p.protectedRank && <Seal rank="tortoise" size={11} color="#9fd3bf" />}
          {p.offline && <HookIcon />}
        </span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- the table */
const OPPONENTS: Seat[] = [
  { name: 'Ana', mark: 'brad', score: 2, unused: 1, used: 0, hand: 6 },
  { name: 'Alexandru-Constantin Pop', mark: 'val', score: 3, unused: 1, used: 1, hand: 9 },
  { name: 'Cezar', mark: 'soare', score: 1, unused: 0, used: 0, hand: 4, stunned: true },
  { name: 'Dana', mark: 'funie', score: 0, unused: 0, used: 0, hand: 8, protectedRank: true },
  { name: 'Elena', mark: 'cruce', score: 1, unused: 0, used: 0, hand: 5, offline: true },
];

function TopBar({ text, mine }: { text: string; mine?: boolean }) {
  return (
    <header className="ph-top">
      <span className={`ph-top__turn ${mine ? 'is-mine' : ''}`}>{text}</span>
      <span className="ph-top__icons">
        <button className="ph-icon" aria-label="Sunet">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#efe2c8" strokeWidth="2.4">
            <path d="M4,9 H8 L13,5 V19 L8,15 H4 Z" fill="#efe2c8" />
            <path d="M16,9 Q18,12 16,15 M18.5,7 Q22,12 18.5,17" />
          </svg>
        </button>
        <button className="ph-icon" aria-label="Meniu">
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="#efe2c8" strokeWidth="2.6">
            <path d="M4,7 H20 M4,12 H20 M4,17 H20" />
          </svg>
        </button>
      </span>
    </header>
  );
}

function Strip({ seats }: { seats: Seat[] }) {
  return (
    <div className="ph-strip">
      {seats.map((p) => (
        <Chip key={p.name} p={p} />
      ))}
    </div>
  );
}

function Pond({ count, ticker }: { count: number; ticker: React.ReactNode }) {
  return (
    <div className="ph-pond">
      <div className="pond__basin">
        <div className="pond__stack">
          <span className="pond__shim" style={{ left: 6, top: 0 }} />
          <span className="pond__shim" style={{ left: 3, top: 3 }} />
          <div style={{ position: 'absolute', left: 0, top: 6 }}>
            <CardBack width={60} height={90} />
          </div>
        </div>
        <div className="pond__plaque">
          <span className="pond__count">{count}</span>
          <span className="pond__label">în baltă</span>
        </div>
      </div>
      <div className="pond__ticker">{ticker}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- the hand */
const ABBR: Record<string, string> = {
  squid: 'SEP', shark: 'REC', tortoise: 'ȚES', jellyfish: 'MED', lanternfish: 'FEL', stickleback: 'GHI',
  mantisShrimp: 'CRE', whale: 'BAL', clownfish: 'CLO', herring: 'HER', mackerel: 'MAC', anchovy: 'HAM',
  sardine: 'SAR', carp: 'CRA', trout: 'PĂS', perch: 'BIB', catfish: 'SOM', eggs: 'ICR',
};

interface Group {
  cards: Rank[];
  layable?: boolean;
}

const CARD_W = 104;
const CARD_H = 156;

function fit(groups: Group[], avail: number) {
  const n = groups.reduce((s, g) => s + g.cards.length, 0);
  const inStep = 26;
  const extras = n - groups.length;
  const gStep = Math.min(62, Math.floor((avail - CARD_W - extras * inStep) / Math.max(1, groups.length - 1)));
  return { inStep, gStep };
}

function Hand({ groups, avail, selected }: { groups: Group[]; avail: number; selected?: number }) {
  const { inStep, gStep } = fit(groups, avail);
  return (
    <div className="hand" style={{ height: CARD_H + 26 }}>
      {groups.map((g, gi) => {
        const groupWidth = CARD_W + (g.cards.length - 1) * inStep;
        return (
          <div
            key={gi}
            className={`hgroup ${g.layable ? 'is-layable' : ''} ${selected === gi ? 'is-selected' : ''}`}
            style={{ marginLeft: gi === 0 ? 0 : gStep - CARD_W, width: groupWidth, zIndex: gi + 1 }}
          >
            {g.layable && <div className="hgroup__tab">Pune jos</div>}
            {g.cards.length > 1 && !g.layable && <div className="hgroup__count">×{g.cards.length}</div>}
            {g.cards.map((r, ci) => (
              <div key={ci} className="hcard" style={{ left: ci * inStep, zIndex: ci + 1 }}>
                <Card rank={r} size="lg" />
                <span className={`hcard__index ${r === 'eggs' ? 'is-light' : ''}`}>{ABBR[r]}</span>
              </div>
            ))}
            {g.layable && <div className="hgroup__rope" />}
          </div>
        );
      })}
    </div>
  );
}

const MY_HAND: Group[] = [
  { cards: ['shark'] },
  { cards: ['tortoise', 'tortoise'] },
  { cards: ['jellyfish'] },
  { cards: ['herring', 'herring', 'eggs'], layable: true },
  { cards: ['catfish'] },
  { cards: ['trout'] },
];

function Dock({ children, turn, hint }: { children?: React.ReactNode; turn?: boolean; hint: string }) {
  return (
    <section className={`ph-dock ${turn ? 'is-turn' : ''}`}>
      <div className="dock__head">
        <div className="dock__me">
          {turn && (
            <span className="dock__totem">
              <Totem size={14} />
            </span>
          )}
          <Mark id="rozeta" size={13} color="#17120e" />
          <span className="dock__name">Tu</span>
          <span className="dock__score">1</span>
          <PowerPips unused={1} used={0} />
          <span className="dock__hand">· 9 cărți</span>
        </div>
        <span className="dock__hint">{hint}</span>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ frames */
function YourTurn({ avail }: { avail: number }) {
  return (
    <div className="ph">
      <TopBar text="Rândul tău" mine />
      <Strip seats={OPPONENTS} />
      <Pond
        count={11}
        ticker={
          <>
            <Mark id="soare" size={11} color="#9db3bd" /> Cezar → Dana: <Seal rank="herring" size={11} color="#9db3bd" inline /> Hering? — „Pescuiește!”
          </>
        }
      />
      <Dock turn hint="Alege o carte">
        <Hand groups={MY_HAND} avail={avail} />
      </Dock>
    </div>
  );
}

function AskSheet({ avail }: { avail: number }) {
  return (
    <div className="ph">
      <TopBar text="Rândul tău" mine />
      <Strip seats={OPPONENTS} />
      <Pond count={11} ticker={<>Cezar → Dana: Hering? — „Pescuiește!”</>} />
      <div className="sheet">
        <div className="sheet__title">
          <Seal rank="tortoise" size={16} color="#17120e" />
          Cere <strong>Țestoasă</strong> de la…
          <button className="sheet__close" aria-label="Renunță">×</button>
        </div>
        <div className="sheet__grid">
          {OPPONENTS.map((p) => (
            <button key={p.name} className={`sheet__who ${p.stunned ? 'is-off' : ''}`} disabled={p.stunned}>
              <Mark id={p.mark} size={18} color="#17120e" />
              <span className="sheet__name">{p.name}</span>
              <span className="sheet__meta">
                {p.stunned ? (
                  <>
                    <Seal rank="jellyfish" size={12} color="#3b322a" /> amețit
                  </>
                ) : p.offline ? (
                  <>plecat · auto</>
                ) : (
                  <>
                    <FanIcon /> {p.hand}
                  </>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
      <Dock turn hint="Atinge un jucător">
        <Hand groups={MY_HAND} avail={avail} selected={1} />
      </Dock>
    </div>
  );
}

function Answer({ avail }: { avail: number }) {
  const seats = OPPONENTS.map((p, i) => ({ ...p, current: i === 0 }));
  return (
    <div className="ph">
      <TopBar text="Rândul Anei" />
      <Strip seats={seats} />
      <Pond count={11} ticker={<>Ana → Tu: Țestoasă?</>} />
      <Dock hint="">
        <Hand groups={MY_HAND} avail={avail} />
      </Dock>
      <div className="plank">
        <div className="plank__chip" aria-hidden="true">
          <Seal rank="tortoise" size={18} color="#17120e" />
        </div>
        <div className="plank__top">
          <div className="plank__card">
            <Card rank="tortoise" size="md" />
          </div>
          <div className="plank__say">
            <div className="plank__who">
              <Mark id="brad" size={13} color="#e3d3b4" /> Ana îți cere
            </div>
            <div className="plank__rank">Țestoasă?</div>
            <div className="plank__sub">Ai 2 în mână.</div>
          </div>
        </div>
        <NotchClock secondsLeft={8} total={12} />
        <div className="plank__actions">
          <button className="plank__btn">Uite, ia-le!</button>
          <button className="plank__btn">Minte — Sepia</button>
        </div>
        <div className="plank__hint">Cele două butoane arată, sună și vibrează la fel.</div>
      </div>
    </div>
  );
}

function DryPond({ avail }: { avail: number }) {
  const seats = OPPONENTS.map((p, i) => ({ ...p, current: i === 1 }));
  return (
    <div className="ph">
      <TopBar text="Rândul lui Alexandru" />
      <Strip seats={seats} />
      <div className="ph-pond">
        <div className="pond__basin is-dry">
          <svg width="150" height="92" viewBox="0 0 150 92" aria-hidden="true">
            <path d="M10,64 Q75,86 140,64" fill="none" stroke="#40291a" strokeWidth="5" />
            <path d="M34,62 L48,54 L60,63 M88,66 L99,57 L114,64" fill="none" stroke="#6b4a2f" strokeWidth="3" />
            <g transform="translate(62,34) rotate(24)">
              <circle r="15" fill="#d99a2b" stroke="#17120e" strokeWidth="3" />
            </g>
            <g transform="translate(54,26)">
              <Seal rank="tortoise" size={16} color="#17120e" />
            </g>
            <path d="M84,40 l6,-4 M86,48 l8,0 M84,56 l6,4" stroke="#e3d3b4" strokeWidth="2.5" />
          </svg>
          <div className="pond__plaque">
            <span className="pond__count">0</span>
            <span className="pond__label">balta e goală</span>
          </div>
        </div>
        <div className="pond__ticker">Alexandru → Dana: Țestoasă? — „Pescuiește!” · nimic de tras</div>
      </div>
      <Dock hint="">
        <Hand groups={MY_HAND} avail={avail} />
      </Dock>
    </div>
  );
}

function ChipSheet() {
  const base: Seat = { name: 'Bogdan', mark: 'val', score: 2, unused: 0, used: 0, hand: 7 };
  const cases: { label: string; p: Seat }[] = [
    { label: 'default', p: base },
    { label: 'current turn (totem)', p: { ...base, current: true } },
    { label: 'stunned (branded seal, ink at 45%)', p: { ...base, stunned: true } },
    { label: 'protected (shell + seal)', p: { ...base, protectedRank: true } },
    { label: 'disconnected (dashed, hook)', p: { ...base, offline: true } },
    { label: '24-character name', p: { ...base, name: 'Alexandru-Constantin Pop' } },
    { label: '3 points: 2 power sets (1 unused, 1 used)', p: { ...base, score: 3, unused: 1, used: 1 } },
    {
      label: 'worst case: long name, protected, offline, 12 cards, 3 power sets',
      p: { ...base, name: 'Alexandru-Constantin Pop', score: 4, unused: 2, used: 1, hand: 12, protectedRank: true, offline: true, current: false },
    },
  ];
  return (
    <div className="chipsheet">
      <h2 className="chipsheet__title">Opponent chip — 60 × 76 px, shown at 2×</h2>
      <div className="chipsheet__grid">
        {cases.map((c) => (
          <figure key={c.label} className="chipsheet__cell">
            <div className="chipsheet__zoom">
              <Chip p={c.p} />
            </div>
            <figcaption>{c.label}</figcaption>
          </figure>
        ))}
      </div>
      <p className="chipsheet__legend">
        <PowerPips unused={1} used={0} /> unused power set (hidden or face-up) &nbsp; <PowerPips unused={0} used={1} /> used or destroyed
        &nbsp;·&nbsp; score = sets laid &nbsp;·&nbsp; full name, sets and protected ranks open in a drawer on tap
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- mount */
function App() {
  const frame = new URLSearchParams(location.search).get('frame') ?? 'your-turn';
  const avail = Math.min(window.innerWidth, 600) - 24;
  return (
    <GameProvider>
      <ArtDefs />
      {frame === 'ask-sheet' ? <AskSheet avail={avail} /> : frame === 'answer' ? <Answer avail={avail} /> : frame === 'chips' ? <ChipSheet /> : frame === 'dry' ? <DryPond avail={avail} /> : <YourTurn avail={avail} />}
    </GameProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
