/* Layout mocks for FEEL_VISUAL_SOUND_PLAN.md §5.2–§5.3, built from the client's real
 * card art, seals, totem, notch clock, fonts and tokens. Frames are chosen with ?frame=:
 *   your-turn · ask-sheet · answer · dry · chips · desktop
 * The textures are quick feTurbulence stand-ins for the §5.4 tiles, not final art. */
import type { Rank } from '@pescuit/engine';
import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../../packages/client/src/styles.css';
import { ArtDefs } from '../../../packages/client/src/art/defs.tsx';
import { Seal } from '../../../packages/client/src/art/seals.tsx';
import { HandFan, NotchClock, Totem } from '../../../packages/client/src/art/table.tsx';
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
const HookIcon = ({ size = 11, color = '#e8b4a8' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" aria-hidden="true">
    <path d="M15,2 V14 A5.5,5.5 0 1 1 4.5,11.5 M4.5,11.5 L8,9.5" />
  </svg>
);

/** The verdigris shell of a protected player. */
const ShellIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2,18 Q12,0 22,18 Z" fill="#3d7a66" stroke="#17120e" strokeWidth="2.4" />
  </svg>
);

/** One diamond per power set: filled = unused (hidden or face-up), open = used or destroyed. */
function PowerPips({ unused, used }: { unused: number; used: number }) {
  return (
    <span className="pips-power" aria-label={`${unused} unused, ${used} used power sets`}>
      {Array.from({ length: unused }, (_, i) => (
        <svg key={`u${i}`} width="8" height="8" viewBox="0 0 8 8">
          <polygon points="4,0 8,4 4,8 0,4" fill="#6b7fc9" stroke="#efe2c8" strokeWidth="1" />
        </svg>
      ))}
      {Array.from({ length: used }, (_, i) => (
        <svg key={`s${i}`} width="8" height="8" viewBox="0 0 8 8">
          <polygon points="4,0.8 7.2,4 4,7.2 0.8,4" fill="none" stroke="#b9ab96" strokeWidth="1.3" />
        </svg>
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
  protectedRank?: Rank;
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
      <div className="chip__plate">
        <span className="chip__name">{shortName(p.name)}</span>
      </div>
      <div className="chip__row">
        <Mark id={p.mark} size={12} color="#e3d3b4" />
        <span className="chip__score num">{p.score}</span>
        <PowerPips unused={p.unused} used={p.used} />
      </div>
      <div className="chip__row chip__row--foot">
        <span className="chip__hand num">
          <FanIcon />
          {p.hand}
        </span>
        <span className="chip__status">
          {p.stunned && <Seal rank="jellyfish" size={11} color="#efe2c8" />}
          {p.protectedRank && <Seal rank={p.protectedRank} size={11} color="#9fd3bf" />}
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
  { name: 'Dana', mark: 'funie', score: 2, unused: 0, used: 1, hand: 6, protectedRank: 'tortoise' },
  { name: 'Elena', mark: 'cruce', score: 1, unused: 0, used: 0, hand: 5, offline: true },
];

const SpeakerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#efe2c8" strokeWidth="2.4">
    <path d="M4,9 H8 L13,5 V19 L8,15 H4 Z" fill="#efe2c8" />
    <path d="M16,9 Q18,12 16,15 M18.5,7 Q22,12 18.5,17" />
  </svg>
);
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" stroke="#efe2c8" strokeWidth="2.6">
    <path d="M4,7 H20 M4,12 H20 M4,17 H20" />
  </svg>
);

function TopBar({ text, mine, className = 'ph-top' }: { text: string; mine?: boolean; className?: string }) {
  return (
    <header className={className}>
      <span className={`ph-top__turn ${mine ? 'is-mine' : ''}`}>{text}</span>
      <span className="ph-top__icons">
        <button className="ph-icon" aria-label="Sunet">
          <SpeakerIcon />
        </button>
        <button className="ph-icon" aria-label="Meniu">
          <MenuIcon />
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

/** The fallback "closing gate" (§3.9): one notch per miss toward the 2N limit. */
function Gate({ misses, limit }: { misses: number; limit: number }) {
  return (
    <div className="gate" aria-label={`${limit - misses} misses left`}>
      <div className="gate__notches">
        {Array.from({ length: limit }, (_, i) => (
          <span key={i} className={`gate__notch ${i < misses ? 'is-shut' : ''}`} />
        ))}
      </div>
      <span className="gate__label">
        <span className="num">{limit - misses}</span> încercări până se închide balta
      </span>
    </div>
  );
}

/** The pond's tally (§3.9): 18 notches on the basin rim, one per set that can still be laid,
 *  computed from the public record. A lay knocks its notch out; the last one is inked. */
function Tally({ sets }: { sets: number }) {
  return (
    <div className="tally" aria-label={`${sets} seturi încă posibile`}>
      <span className="tally__notches">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} className={`tally__notch ${i >= sets ? 'is-gone' : ''} ${sets === 1 && i === 0 ? 'is-last' : ''}`} />
        ))}
      </span>
      <span className="tally__label">{sets === 1 ? 'ultimul set' : <>încă <span className="num">{sets}</span> seturi</>}</span>
    </div>
  );
}

function Pond({ count, ticker, dry, gate, sets = 9 }: { count: number; ticker: React.ReactNode; dry?: boolean; gate?: [number, number]; sets?: number }) {
  return (
    <div className="ph-pond">
      <div className={`pond__basin ${dry ? 'is-dry' : ''}`}>
        {dry ? (
          <svg width="150" height="92" viewBox="0 0 150 92" aria-hidden="true">
            <path d="M10,64 Q75,86 140,64" fill="none" stroke="#40291a" strokeWidth="5" />
            <path d="M34,62 L48,54 L60,63 M88,66 L99,57 L114,64" fill="none" stroke="#6b4a2f" strokeWidth="3" />
            <g transform="translate(62,50) rotate(24)">
              <circle r="13" fill="#d99a2b" stroke="#17120e" strokeWidth="3" />
            </g>
            <g transform="translate(55,43)">
              <Seal rank="tortoise" size={14} color="#17120e" />
            </g>
          </svg>
        ) : (
          <div className="pond__stack">
            <span className="pond__shim" style={{ left: 6, top: 0 }} />
            <span className="pond__shim" style={{ left: 3, top: 3 }} />
            <div style={{ position: 'absolute', left: 0, top: 6 }}>
              <CardBack width={60} height={90} />
            </div>
          </div>
        )}
        <div className="pond__plaque">
          <span className="pond__count num">{count}</span>
          <span className="pond__label">în baltă</span>
        </div>
      </div>
      <Tally sets={sets} />
      {gate && <Gate misses={gate[0]} limit={gate[1]} />}
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

/** Card size follows the room the screen has: bigger on tall phones, never below 104×156. */
function cardSize(): { w: number; h: number } {
  if (window.innerWidth >= 1000) return { w: 132, h: 198 };
  return window.innerHeight >= 660 ? { w: 116, h: 174 } : { w: 104, h: 156 };
}

function Hand({ groups, avail, selected }: { groups: Group[]; avail: number; selected?: number }) {
  const { w, h } = cardSize();
  const n = groups.reduce((s, g) => s + g.cards.length, 0);
  const inStep = Math.round(w * 0.25);
  const gStep = Math.min(Math.round(w * 0.6), Math.floor((avail - w - (n - groups.length) * inStep) / Math.max(1, groups.length - 1)));
  return (
    <div className="hand" style={{ height: h + 26, ['--cw' as string]: `${w}px`, ['--ch' as string]: `${h}px` }}>
      {groups.map((g, gi) => (
        <div
          key={gi}
          className={`hgroup ${g.layable ? 'is-layable' : ''} ${selected === gi ? 'is-selected' : ''}`}
          style={{ marginLeft: gi === 0 ? 0 : gStep - w, width: w + (g.cards.length - 1) * inStep, zIndex: gi + 1 }}
        >
          {g.layable && <div className="hgroup__tab">Pune jos</div>}
          {g.cards.length > 1 && !g.layable && <div className="hgroup__count num">×{g.cards.length}</div>}
          {g.cards.map((r, ci) => (
            <div key={ci} className="hcard" style={{ left: ci * inStep, zIndex: ci + 1 }}>
              <Card rank={r} size="lg" />
              <span className={`hcard__index ${r === 'eggs' ? 'is-light' : ''}`}>{ABBR[r]}</span>
            </div>
          ))}
          {g.layable && <div className="hgroup__rope" />}
        </div>
      ))}
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
          <span className="dock__score num">1</span>
          <PowerPips unused={1} used={0} />
          <span className="dock__hand">
            · <span className="num">9</span> cărți
          </span>
        </div>
        <span className="dock__hint">{hint}</span>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ frames */
const phoneAvail = () => Math.min(window.innerWidth, 600) - 24;

function YourTurn() {
  return (
    <div className="ph">
      <TopBar text="Rândul tău" mine />
      <Strip seats={OPPONENTS} />
      <Pond
        count={11}
        ticker={
          <>
            <Mark id="cruce" size={11} color="#9db3bd" /> Elena e plecată — tura trece
          </>
        }
      />
      <Dock turn hint="Alege o carte">
        <Hand groups={MY_HAND} avail={phoneAvail()} />
      </Dock>
    </div>
  );
}

function AskSheet() {
  return (
    <div className="ph">
      <TopBar text="Rândul tău" mine />
      <Strip seats={OPPONENTS} />
      {/* while it is open, the sheet takes the pond's row: always between the strip and the dock */}
      <div className="sheet">
        <div className="sheet__title">
          <Seal rank="tortoise" size={16} color="#17120e" />
          Cere <strong>Țestoasă</strong> de la…
          <button className="sheet__close" aria-label="Renunță">
            ×
          </button>
        </div>
        <div className="sheet__grid">
          {OPPONENTS.map((p) => {
            const blocked = p.protectedRank === 'tortoise';
            return (
              <button key={p.name} className={`sheet__who ${p.stunned ? 'is-off' : ''} ${blocked ? 'is-warn' : ''}`} disabled={p.stunned}>
                <Mark id={p.mark} size={18} color="#17120e" />
                <span className="sheet__name">{p.name}</span>
                <span className="sheet__meta">
                  {p.stunned ? (
                    <>
                      <Seal rank="jellyfish" size={12} color="#3b322a" /> amețit
                    </>
                  ) : blocked ? (
                    <>
                      <ShellIcon /> apără <Seal rank="tortoise" size={12} color="#17120e" />
                    </>
                  ) : (
                    <>
                      <FanIcon /> <span className="num">{p.hand}</span>
                      {p.unused > 0 && (
                        <>
                          {' '}
                          · <PowerPips unused={p.unused} used={0} />
                        </>
                      )}
                      {p.offline && (
                        <>
                          {' '}
                          · <HookIcon size={11} color="#a8392a" /> plecat
                        </>
                      )}
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <Dock turn hint="Atinge un jucător">
        <Hand groups={MY_HAND} avail={phoneAvail()} selected={1} />
      </Dock>
    </div>
  );
}

function Answer() {
  const seats = OPPONENTS.map((p, i) => ({ ...p, current: i === 0 }));
  return (
    <div className="ph">
      <TopBar text="Rândul Anei" />
      <Strip seats={seats} />
      <Pond count={11} ticker={<>Ana → Tu: Țestoasă?</>} />
      <Dock hint="">
        <Hand groups={MY_HAND} avail={phoneAvail()} />
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
            <div className="plank__sub">
              Ai <span className="num">2</span> în mână.
            </div>
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

function DryPond() {
  const seats = OPPONENTS.map((p, i) => ({ ...p, current: i === 1 }));
  return (
    <div className="ph">
      <TopBar text="Rândul lui Alexandru" />
      <Strip seats={seats} />
      <Pond count={0} dry sets={1} gate={[9, 12]} ticker={<>Alexandru → Dana: Țestoasă? — Pescuiește!</>} />
      <Dock hint="">
        <Hand groups={MY_HAND} avail={phoneAvail()} />
      </Dock>
    </div>
  );
}

function ChipSheet() {
  const base: Seat = { name: 'Bogdan', mark: 'val', score: 2, unused: 0, used: 0, hand: 7 };
  const long = 'Alexandru-Constantin Pop';
  const cases: { label: string; p: Seat }[] = [
    { label: 'default', p: base },
    { label: 'current turn (totem)', p: { ...base, current: true } },
    { label: 'stunned: branded plate, score kept', p: { ...base, stunned: true } },
    { label: 'protected: shell and rank seal', p: { ...base, protectedRank: 'tortoise' } },
    { label: 'disconnected: dashed, hook', p: { ...base, offline: true } },
    { label: '24-character name, 11 points', p: { ...base, name: long, score: 11 } },
    {
      label: 'worst case A: stunned, protected, offline, long name, 3 power sets, 12 cards',
      p: { ...base, name: long, score: 4, unused: 2, used: 1, hand: 12, stunned: true, protectedRank: 'mantisShrimp', offline: true },
    },
    {
      label: 'worst case B: current, protected, offline, long name (the table waits)',
      p: { ...base, name: long, score: 4, unused: 1, used: 1, hand: 11, current: true, protectedRank: 'tortoise', offline: true },
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
        <span>
          <PowerPips unused={1} used={0} /> unused power set (hidden or face-up)
        </span>
        <span>
          <PowerPips unused={0} used={1} /> used or destroyed
        </span>
        <span>score = sets laid</span>
        <span>numerals: Source Serif 4 lining figures, flagged 1</span>
        <span>a stunned player never holds the totem</span>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ the desktop */
// A legal run of turns: Cezar asks, then Dana stuns him at the start of her turn, so he is
// stunned now and skips his next turn; Elena is away, so hers passes.
const LOG: [MarkId, Rank | 'turn', string][] = [
  ['soare', 'herring', 'Cezar cere de la Ana: Hering.'],
  ['soare', 'herring', 'Pescuiește! Cezar trage din baltă.'],
  ['funie', 'jellyfish', 'Dana folosește Meduza: Cezar pierde tura următoare.'],
  ['funie', 'catfish', 'Dana cere de la Elena: Somn.'],
  ['cruce', 'catfish', 'Elena îi dă 2 cărți de Somn.'],
  ['funie', 'catfish', 'Dana pune jos un set de Somn.'],
  ['cruce', 'turn', 'Elena e plecată — tura trece.'],
  ['rozeta', 'turn', 'Rândul tău.'],
];

function Post({ p, lift }: { p: Seat; lift: number }) {
  return (
    <div className={`post-d ${p.current ? 'is-current' : ''} ${p.stunned ? 'is-stunned' : ''} ${p.offline ? 'is-offline' : ''}`} style={{ marginTop: lift }}>
      {p.protectedRank && (
        <svg className="post-d__shell" viewBox="0 0 150 16" preserveAspectRatio="none" aria-hidden="true">
          <path d="M2,15 Q75,-8 148,15 L148,16 Q75,1 2,16 Z" fill="#3d7a66" stroke="#17120e" strokeWidth="2" />
        </svg>
      )}
      <div className="post-d__plate">
        {p.stunned && <Seal rank="jellyfish" size={13} color="#efe2c8" />}
        <span>{p.name.length > 16 ? `${p.name.slice(0, 15)}…` : p.name}</span>
      </div>
      <div className="post-d__row">
        <Mark id={p.mark} size={16} color="#e3d3b4" />
        <span className="post-d__score num">{p.score}</span>
        <PowerPips unused={p.unused} used={p.used} />
      </div>
      <div className="post-d__row post-d__row--foot">
        <span className="post-d__fan">
          <HandFan count={p.hand} />
        </span>
        <span className="chip__status">
          {p.protectedRank && <Seal rank={p.protectedRank} size={13} color="#9fd3bf" />}
          {p.offline && <HookIcon size={13} />}
        </span>
      </div>
    </div>
  );
}

function Desktop() {
  const lifts = [30, 10, 0, 10, 30];
  return (
    <div className="dk">
      <TopBar text="Rândul tău" mine className="ph-top dk-top" />
      <main className="dk-main">
        <section className="dk-table">
          <div className="dk-posts">
            {OPPONENTS.map((p, i) => (
              <Post key={p.name} p={p} lift={lifts[i]} />
            ))}
          </div>
          <Pond count={11} ticker={<>Elena e plecată — tura trece · rândul tău</>} />
          <div className="dk-me">
            <div className="dk-me__post">
              <span className="dock__totem">
                <Totem size={18} />
              </span>
              <Mark id="rozeta" size={16} color="#17120e" />
              <span className="dock__name">Tu</span>
              <span className="dock__score num">1</span>
              <PowerPips unused={1} used={0} />
              <span className="dk-me__hint">Trage un grup peste un jucător — sau atinge grupul, apoi jucătorul.</span>
            </div>
            <Hand groups={MY_HAND} avail={Math.min(880, window.innerWidth - (window.innerWidth >= 1100 ? 364 : 136))} />
          </div>
        </section>
        <button className="dk-log-tab" aria-label="Deschide jurnalul">
          Jurnal
        </button>
        <aside className="dk-log">
          <h3 className="dk-log__title">Jurnal</h3>
          {LOG.map(([m, r, text], i) => (
            <div key={i} className={`dk-log__line ${i >= LOG.length - 3 ? 'is-recent' : ''}`}>
              <Mark id={m} size={13} color="currentColor" />
              {r !== 'turn' ? <Seal rank={r} size={14} color="currentColor" /> : <span style={{ width: 14, flex: 'none' }} />}
              <span>{text}</span>
            </div>
          ))}
        </aside>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------- mount */
function App() {
  const frame = new URLSearchParams(location.search).get('frame') ?? 'your-turn';
  const view =
    frame === 'ask-sheet' ? (
      <AskSheet />
    ) : frame === 'answer' ? (
      <Answer />
    ) : frame === 'chips' ? (
      <ChipSheet />
    ) : frame === 'dry' ? (
      <DryPond />
    ) : frame === 'desktop' ? (
      <Desktop />
    ) : (
      <YourTurn />
    );
  return (
    <GameProvider>
      <ArtDefs />
      {view}
    </GameProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
