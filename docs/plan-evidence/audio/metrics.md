| Cue | Class | Active ms | Raw peak dBFS | Active LUFS | Momentary max | Tail vs head dB | Speaker variant ms (by design) | Speaker tail vs head dB (by design) | Class norm dB | Seed spread dB |
|---|---|---|---|---|---|---|---|---|---|---|
| `table.turn` | T | 203 | -6.2 | -23.2 | -26.1 | — | 203 | — | 3.2 | 0.1 |
| `table.turn.you` | T | 190 | -6.5 | -22.7 | -25.9 | — | 190 | — | 2.7 | 0.1 |
| `table.ask` | T | 203 | -6.1 | -24.8 | -27.7 | — | 203 | — | 4.8 | 0.0 |
| `table.bonus` | T | 129 | -4.0 | -21.3 | -26.3 | — | 129 | — | 1.3 | 0.2 |
| `table.flight` | T | 260 | -12.8 | -23.5 | -25.4 | -25.6 | 260 | -25.6 | 3.5 | 0.3 |
| `table.asked` | T | 151 | -5.4 | -22.3 | -26.5 | — | 151 | — | 2.3 | 0.1 |
| `table.answer` | T | 63 | -2.4 | -18.0 | -26.1 | — | 63 | — | -2.0 | 0.0 |
| `clock.close` | T | 54 | -3.6 | -19.6 | -28.3 | — | 54 | — | -0.4 | 0.5 |
| `table.give` | T | 331 | -2.1 | -18.5 | -19.3 | -1.8 | 192 | — | -1.5 | 0.2 |
| `table.gofish` | T | 100 | -6.6 | -21.8 | -27.8 | — | 100 | — | 1.8 | 0.5 |
| `table.gofish.dry` | T | 183 | -6.2 | -25.8 | -29.2 | — | 183 | — | 5.8 | 0.1 |
| `table.draw` | T | 44 | -10.2 | -21.6 | -31.2 | — | 44 | — | 1.6 | 0.5 |
| `table.lay` | T | 425 | -1.2 | -21.7 | -21.5 | 1.3 | 204 | — | 1.7 | 0.2 |
| `clock.tick` | T | 60 | -4.0 | -21.2 | -29.4 | — | 60 | — | 1.2 | 0.3 |
| `clock.tick.urgent` | T | 60 | -4.3 | -21.0 | -29.3 | — | 60 | — | 1.0 | 0.2 |
| `power.granted` | S | 1400 | -10.6 | -27.6 | -22.8 | 3.8 | 200 | — | -0.2 | 1.0 |
| `power.used.lanternfish` | S | 892 | -10.7 | -21.5 | -19.2 | 7.3 | 214 | — | -3.8 | 0.0 |
| `power.used.whale` | S | 1100 | -7.5 | -14.3 | -12.9 | 4.7 | 226 | — | -10.1 | 0.0 |
| `power.mantis` | T | 288 | -2.1 | -23.9 | -25.3 | -18.5 | 288 | -18.5 | 3.9 | 0.2 |
| `power.shark` | T | 427 | 1.2 | -14.8 | -14.6 | -15.1 | 418 | -35.6 | -5.2 | 0.0 |
| `power.jellyfish` | S | 538 | -0.3 | -20.4 | -20.9 | 2.4 | 192 | — | -2.1 | 0.0 |
| `power.whale` | S | 1337 | 0.7 | -18.1 | -13.6 | 4.5 | 236 | — | -9.4 | 0.0 |
| `mus.start` | S | 2408 | -6.9 | -16.4 | -14.2 | 11.8 | 2408 | 11.8 | -8.8 | 0.0 |

| Profile | Target LUFS | Integrated LUFS | Short-term max | True peak dBTP | Six-cue burst true peak dBTP | Program gain dB | Samples within 0.5 dB of the clip |
|---|---|---|---|---|---|---|---|
| speaker | -18 | -18.0 | -16.9 | -3.5 | -3.9 | -5.4 | 0.000 % |
| headphones | -23 | -23.0 | -16.4 | -1.8 | -1.8 | 4.9 | 0.000 % |

The scripted scene (three minutes, five players, human pace, heard from seat 0) plays 24 cues a minute: table 19, clock 4.3, power 0.7, at 4.7 asks a minute. The 12 s listening excerpts start at 21.2 s, the scene's busiest stretch.

- PASS — plank grammar: no cue but the seat cues strikes plank A, B or C.
- PASS — echo budget, by design: every speaker variant keeps its energy after 250 ms at least 12 dB under the first 250 ms (`mus.start` exempt).
- PASS — loudness per profile within ±2 LU of target, true peak ≤ −1 dBTP in the scene and the six-cue burst, and no samples near the clip.
