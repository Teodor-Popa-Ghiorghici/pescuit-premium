import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* Source guards for the rules of SOUND_DESIGN.md that are about how the code is written rather than what it returns. */

const root = join(__dirname, '..', 'src');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');
/** the code with its comments taken out, so a rule is not tripped by a sentence that explains it */
const code = (rel: string): string => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const audioFiles = (dir = 'audio'): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? audioFiles(join(dir, d.name)) : d.name.endsWith('.ts') || d.name.endsWith('.tsx') ? [join(dir, d.name)] : []));

describe('the audition page is development only', () => {
  it('main.tsx imports it behind import.meta.env.DEV, so a production build drops it', () => {
    const main = code('main.tsx');
    const at = main.indexOf("import('./audio/lab.js')");
    expect(at).toBeGreaterThan(0);
    expect(main.slice(Math.max(0, at - 200), at)).toContain('import.meta.env.DEV');
  });
  it('nothing outside the lab imports the lab', () => {
    for (const f of audioFiles('.')) {
      if (f.endsWith('main.tsx') || f.endsWith('audio/lab.tsx')) continue;
      expect(code(f), f).not.toMatch(/audio\/lab|from '\.\/lab/);
    }
  });
});

describe('the mapping layer never blocks and never guesses', () => {
  it('cues.ts is synchronous and pure: no await, no timers, no clock, no randomness, no DOM', () => {
    const c = code('audio/cues.ts');
    for (const bad of [/\basync\b/, /\bawait\b/, /\bPromise\b/, /setTimeout|setInterval|requestAnimationFrame/, /Math\.random/, /Date\.now|performance\./, /\bdocument\.|\bwindow\.|typeof window|globalThis|localStorage/]) expect(c, String(bad)).not.toMatch(bad);
  });
  it('cues.ts imports no engine event types and no redactors: it is handed the wire and reads only the list', () => {
    const imports = read('audio/cues.ts').split('\n').filter((l) => l.startsWith('import'));
    expect(imports.join('\n')).not.toMatch(/@pescuit\/engine|redact/);
  });
  it('no input path waits on audio: the presenter and the window never await an engine call', () => {
    for (const f of ['game/presenter.ts', 'components/Windows.tsx', 'components/GameTable.tsx']) expect(code(f), f).not.toMatch(/await\s+(getEngine|engine)/);
  });
});

describe('no looping music, no melody in the play', () => {
  it('no buffer is looped except the ambience\'s shared noise', () => {
    for (const f of audioFiles()) {
      if (f.endsWith('ambience.ts') || f.endsWith('lab.tsx')) continue;
      expect(code(f), f).not.toMatch(/\.loop\s*=\s*true/);
    }
    const amb = code('audio/ambience.ts');
    expect(amb.match(/\.loop\s*=\s*true/g)?.length).toBe(1);
    expect(amb).toContain('sharedNoise'); // the one thing it loops
  });
  it('there is no pitched instrument left in the palette but the tulnic: no fluier, caval, drâmbă, țambal or Karplus-Strong strings', () => {
    for (const f of audioFiles()) {
      if (f.endsWith('lab.tsx')) continue;
      expect(code(f), f).not.toMatch(/renderBreath|renderDramba|renderStrings|fluier|caval|țambal|dramba/i);
    }
  });
  it('the ambience has no oscillators at all: no sine bleeps, no birds', () => {
    expect(code('audio/ambience.ts')).not.toMatch(/createOscillator/);
    expect(code('audio/live/water.ts').match(/createOscillator/g)?.length).toBe(1); // the drain gurgle's bubble; the drip is noise
  });
});

describe('the background score (MUSIC_PLAN §5, §10.2)', () => {
  const scoreFiles = audioFiles('audio/score');
  it('nothing in score/ imports a hand, a grant, a window, the seat facts, the cue mapping or the engine\'s types', () => {
    expect(scoreFiles.length).toBeGreaterThan(5);
    for (const f of scoreFiles) {
      const imports = read(f).split('\n').filter((l) => /^\s*import\b/.test(l)).join('\n');
      expect(imports, f).not.toMatch(/@pescuit\/engine|redact|seatFacts|SeatFacts|handModel|cues\.js|record\.js|presenter/);
      expect(code(f), f).not.toMatch(/\.hand\b|ownPowerGrants|pendingWindow|youAreEligible|currentPlayerId|powerVisibility|laidSets|\.winners|\.scores\b/);
    }
  });
  it('the decisions are pure: plan, conductor, phrases, voicing and input use no clock, no randomness, no timers and no DOM', () => {
    for (const f of ['plan.ts', 'conductor.ts', 'phrases.ts', 'voicing.ts', 'input.ts', 'synth.ts']) {
      const c = code(`audio/score/${f}`);
      for (const bad of [/\basync\b|\bawait\b/, /setTimeout|setInterval|requestAnimationFrame/, /Math\.random/, /Date\.now|performance\./, /\bdocument\.|\bwindow\.|localStorage/]) expect(c, `${f} ${bad}`).not.toMatch(bad);
    }
  });
  it('the only per-client randomness is the hum\'s grain salt, made in index.ts; nothing is looped', () => {
    for (const f of scoreFiles) {
      if (!f.endsWith('index.ts')) expect(code(f), f).not.toMatch(/Math\.random/);
      expect(code(f), f).not.toMatch(/\.loop\s*=\s*true/);
    }
    expect(code('audio/score/index.ts').match(/Math\.random/g)).toHaveLength(1);
  });
  it('no input path waits on the score, and the main bundle never imports it statically (it is a lazy chunk)', () => {
    for (const f of ['game/presenter.ts', 'components/Windows.tsx', 'components/GameTable.tsx', 'hooks/useLobbyAudio.ts', 'state/store.tsx']) expect(code(f), f).not.toMatch(/await\s+(getEngine|engine)|score\/index/);
    const engine = read('audio/engine.ts');
    expect(engine).toMatch(/import type \{[^}]*Score[^}]*\} from '\.\/score\/index\.js'/);
    expect(engine).toMatch(/import\('\.\/score\/index\.js'\)/);
    expect(engine.split('\n').filter((l) => /^import .*score\/index/.test(l) && !/^import type/.test(l))).toEqual([]);
  });
});
