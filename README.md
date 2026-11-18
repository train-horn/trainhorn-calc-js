# trainhorn-calc

Small, zero-dependency JavaScript calculators for train horn setups, with TypeScript types and a CLI:

- **Acoustics**: sound pressure level (SPL) at a distance (inverse-square law), the inverse (distance for a target level), loss per doubling of distance, adding levels of several horns, optional air absorption.
- **Air system**: tank runtime from free air (Boyle's law), blast count, compressor recovery time (constant or linear flow).
- **Electrical**: smallest copper AWG for a 12 V / 24 V run by voltage-drop budget.

It is a port of the tested Python core [`trainhorn-calc`](https://github.com/train-horn/trainhorn-calc) with the same formulas and reference values. Browser versions of these calculators are at [train-horn.com/tools](https://train-horn.com/tools/).

Results are estimates from simple physical models, not measurements, and not a legal noise assessment.

## Install

```sh
npm install trainhorn-calc
```

Node.js 18.3+ (ESM). Works in browsers and Deno too (the library has no Node imports; only the CLI uses `node:util`).

## Examples

```js
import {
  splAtDistance, distanceForSpl, combineLevels,
  tankRuntimeSeconds, blastCount, compressorRecoverySeconds, suggestAwg,
} from 'trainhorn-calc';

splAtDistance(150, 100);                    // 130   (150 dB at 10 ft -> 130 dB at 100 ft)
splAtDistance(120, 10, { refDistance: 1, unit: 'm' }); // 100
distanceForSpl(150, 90);                    // 10000 ft
distanceForSpl(150, 90, { absorptionDbPerKm: 1.9 }); // ~6491 ft with 500 Hz air absorption
combineLevels([100, 100]);                  // 103.01 (two equal horns add ~3 dB)

const secs = tankRuntimeSeconds(5, 150, 110, 10); // 5 gal, 150 -> 110 psi, 10 CFM horn: ~10.92 s
blastCount(secs, 2);                        // 5
compressorRecoverySeconds(2, 110, 150, 1.0); // ~43.7 s

suggestAwg(30, 10).awg;                     // '6'  (30 A, 10 ft one way, 12 V, 3 % drop)
suggestAwg(30, 10, { systemVoltage: 24 }).awg; // '10'
```

Invalid input throws `InputError`, a subclass of `RangeError`:

```js
import { InputError } from 'trainhorn-calc';
try { splAtDistance(150, 0); } catch (e) { e instanceof RangeError; /* true */ }
```

## CLI

```sh
npx trainhorn-calc spl 150 100                 # 130.0 dB at 100 ft
npx trainhorn-calc distance 150 90 --unit ft   # 90 dB is reached at about 10,000.0 ft
npx trainhorn-calc combine 100 100             # 103.0 dB combined
npx trainhorn-calc runtime 5 150 110 10 --blast 2
npx trainhorn-calc recovery 2 110 150 1.0 --cfm-at-zero 2 --rated-psi 150
npx trainhorn-calc wire 30 10 --volts 24 --max-drop 2 --json
```

Every command accepts `--json`. Invalid input prints `error: ...` to stderr and exits with status 2. Run `trainhorn-calc --help` for all options.

## API

All distances default to feet (`unit: 'ft' | 'm'`). Numeric strings are accepted; NaN, Infinity, booleans and out-of-range values throw `InputError`.

### Acoustics

| Function | Returns |
| --- | --- |
| `splAtDistance(sourceDb, distance, { refDistance = 10, unit = 'ft', absorptionDbPerKm = 0 })` | dB at `distance`: `L - 20 log10(d / ref) - alpha (d_m - ref_m) / 1000` |
| `distanceForSpl(sourceDb, targetDb, options)` | distance where the level reaches `targetDb` (closed form, or bisection with absorption) |
| `distanceRatioLoss(ratio)` | `20 log10(ratio)` dB |
| `dbDoublingLoss()` | about 6.02 dB |
| `combineLevels(levels)` | `10 log10(sum 10^(L/10))` dB |
| `AIR_ABSORPTION_DB_PER_KM` | rough dB/km by octave band at 10 degC, 70 % RH (ISO 9613) |

### Air system

| Function | Returns |
| --- | --- |
| `freeAirVolumeCuft(tankGallons, startPsi, endPsi, atmosphericPsi = 14.696)` | cu ft of free air: `V * (P1 - P2) / P_atm` |
| `tankRuntimeSeconds(tankGallons, startPsi, cutoffPsi, hornCfm, atmosphericPsi?)` | seconds of horn time (isothermal upper estimate) |
| `blastCount(runtimeSeconds, blastSeconds)` | whole blasts |
| `compressorRecoverySeconds(tankGallons, cutInPsi, cutOutPsi, compressorCfm, { cfmAtZeroPsi, ratedPsi, atmosphericPsi })` | refill seconds; linear-flow model when both `cfmAtZeroPsi` and `ratedPsi` are given |

Pressures are gauge psi. Lower `atmosphericPsi` for altitude.

### Electrical

| Function | Returns |
| --- | --- |
| `awgDiameterMm(awg)`, `awgAreaMm2(awg)` | conductor size (ASTM B258 formula); `awg` like `10`, `'10 AWG'`, `'1/0'`, `'4/0'` |
| `awgResistanceOhmPer1000ft(awg, temperatureC = 20)` | copper ohms per 1000 ft (100 % IACS) |
| `voltageDrop(amps, oneWayLength, awg, { unit, temperatureC })` | volts lost out and back |
| `suggestAwg(amps, oneWayLength, { systemVoltage = 12, maxDropPct = 3, unit, temperatureC })` | `{ awg, voltageDropV, voltageDropPct, allowedDropPct, systemVoltage, amps, oneWayLength, unit }` |

`suggestAwg` checks voltage drop only, not ampacity or fuse size. Always fuse to protect the wire you choose.

## Tests

```sh
npm test   # node --test
```

The suite ports the Python core's reference vectors (within 1e-9 where the core uses exact values).

## License

MIT
