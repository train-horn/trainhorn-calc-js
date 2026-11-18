/**
 * Command-line interface for `trainhorn-calc <command> ...`.
 *
 * Every command prints a short human-readable answer, or JSON with `--json`.
 * Invalid input prints `error: ...` to stderr and returns exit status 2.
 *
 * @module trainhorn-calc/cli
 */
import { parseArgs } from 'node:util';
import {
  VERSION, InputError, splAtDistance, distanceForSpl, dbDoublingLoss, combineLevels,
  tankRuntimeSeconds, freeAirVolumeCuft, blastCount, compressorRecoverySeconds, suggestAwg, ATMOSPHERIC_PSI,
} from './index.js';

/** Usage text printed by `--help`. */
export const USAGE = `trainhorn-calc ${VERSION}: train horn calculators.
Web versions: https://train-horn.com/tools/

Usage: trainhorn-calc <command> [args] [--json]

Commands:
  spl <source_db> <distance>          SPL at a distance [--ref-distance 10] [--unit ft|m] [--absorption dB/km]
  distance <source_db> <target_db>    distance where a level is reached (same options as spl)
  doubling                            dB lost per doubling of distance
  combine <db> [<db> ...]             combine levels of several horns
  runtime <gal> <start_psi> <cutoff_psi> <horn_cfm>   tank runtime [--blast s] [--atm-psi 14.696]
  recovery <gal> <cut_in> <cut_out> <cfm>             compressor refill [--cfm-at-zero q --rated-psi p] [--atm-psi]
  wire <amps> <one_way_length>        copper AWG [--volts 12] [--max-drop 3] [--unit ft|m] [--temp-c 20]

Options: --json, --help, --version`;

const OPTIONS = {
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  'ref-distance': { type: 'string' },
  unit: { type: 'string' },
  absorption: { type: 'string' },
  blast: { type: 'string' },
  'atm-psi': { type: 'string' },
  'cfm-at-zero': { type: 'string' },
  'rated-psi': { type: 'string' },
  volts: { type: 'string' },
  'max-drop': { type: 'string' },
  'temp-c': { type: 'string' },
};

/** Arity of the positional arguments of each command. */
const ARITY = { spl: 2, distance: 2, doubling: 0, runtime: 4, recovery: 4, wire: 2 };

/**
 * Format a number like Python's `{:g}` for typical inputs (no trailing zeros).
 * @param {number} x Number to format.
 * @returns {string}
 */
const g = (x) => String(Number(x));

/**
 * Parse a numeric CLI argument, throwing InputError with the argument name.
 * @param {string} name Argument name.
 * @param {string|undefined} text Raw text.
 * @param {number} [fallback] Default when `text` is undefined.
 * @returns {number}
 */
function arg(name, text, fallback) {
  if (text === undefined) return fallback;
  const n = Number(text);
  if (text.trim() === '' || Number.isNaN(n)) throw new InputError(`${name} must be a number, got ${JSON.stringify(text)}`);
  return n;
}

/**
 * Run one command and return its JSON data and text line.
 * @param {string} cmd Command name.
 * @param {string[]} pos Positional arguments after the command.
 * @param {Record<string, string|boolean|undefined>} o Parsed options.
 * @returns {{data: object, text: string}}
 */
function run(cmd, pos, o) {
  if (cmd in ARITY && pos.length !== ARITY[cmd]) {
    throw new InputError(`${cmd} takes ${ARITY[cmd]} argument(s), got ${pos.length}`);
  }
  const unit = o.unit ?? 'ft';
  const splOpts = () => ({
    refDistance: arg('--ref-distance', o['ref-distance'], 10),
    unit,
    absorptionDbPerKm: arg('--absorption', o.absorption, 0),
  });
  const atm = () => arg('--atm-psi', o['atm-psi'], ATMOSPHERIC_PSI);
  switch (cmd) {
    case 'spl': {
      const d = arg('distance', pos[1]);
      const level = splAtDistance(arg('source_db', pos[0]), d, splOpts());
      return { data: { distance: d, spl_db: level, unit }, text: `${level.toFixed(1)} dB at ${g(d)} ${unit}` };
    }
    case 'distance': {
      const target = arg('target_db', pos[1]);
      const dist = distanceForSpl(arg('source_db', pos[0]), target, splOpts());
      const pretty = dist.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      return { data: { distance: dist, target_db: target, unit }, text: `${g(target)} dB is reached at about ${pretty} ${unit}` };
    }
    case 'doubling': {
      const loss = dbDoublingLoss();
      return { data: { db_per_doubling: loss }, text: `${loss.toFixed(2)} dB lost per doubling of distance (free field)` };
    }
    case 'combine': {
      if (pos.length === 0) throw new InputError('combine needs at least one level');
      const total = combineLevels(pos.map((p, i) => arg(`level ${i + 1}`, p)));
      return { data: { combined_db: total }, text: `${total.toFixed(1)} dB combined` };
    }
    case 'runtime': {
      const [gal, start, cut, cfm] = pos.map((p, i) => arg(['tank_gal', 'start_psi', 'cutoff_psi', 'horn_cfm'][i], p));
      const secs = tankRuntimeSeconds(gal, start, cut, cfm, atm());
      const fa = freeAirVolumeCuft(gal, start, cut, atm());
      const data = { free_air_cuft: fa, runtime_seconds: secs };
      let text = `${secs.toFixed(1)} s of horn time (${fa.toFixed(2)} cu ft of free air)`;
      if (o.blast !== undefined) {
        const blast = arg('--blast', o.blast);
        data.blasts = blastCount(secs, blast);
        text += `; ${data.blasts} blasts of ${g(blast)} s`;
      }
      return { data, text };
    }
    case 'recovery': {
      const [gal, cin, cout, cfm] = pos.map((p, i) => arg(['tank_gal', 'cut_in_psi', 'cut_out_psi', 'compressor_cfm'][i], p));
      const secs = compressorRecoverySeconds(gal, cin, cout, cfm, {
        cfmAtZeroPsi: arg('--cfm-at-zero', o['cfm-at-zero']),
        ratedPsi: arg('--rated-psi', o['rated-psi']),
        atmosphericPsi: atm(),
      });
      return { data: { recovery_seconds: secs }, text: `${secs.toFixed(1)} s to refill from ${g(cin)} to ${g(cout)} psi` };
    }
    case 'wire': {
      const r = suggestAwg(arg('amps', pos[0]), arg('length', pos[1]), {
        systemVoltage: arg('--volts', o.volts, 12),
        maxDropPct: arg('--max-drop', o['max-drop'], 3),
        unit,
        temperatureC: arg('--temp-c', o['temp-c'], 20),
      });
      return {
        data: r,
        text: `${r.awg} AWG copper: ${r.voltageDropV.toFixed(2)} V drop (${r.voltageDropPct.toFixed(2)}% of ${g(r.systemVoltage)} V, limit ${g(r.allowedDropPct)}%)`,
      };
    }
    default:
      throw new InputError(`unknown command ${JSON.stringify(cmd)}; run trainhorn-calc --help`);
  }
}

/**
 * Entry point used by the `trainhorn-calc` bin and by tests.
 * @param {string[]} argv Arguments after the program name.
 * @param {{out?: (s: string) => void, err?: (s: string) => void}} [io] Output sinks (default console).
 * @returns {number} Exit status: 0 on success, 2 on invalid input or usage.
 */
export function main(argv, io = {}) {
  const out = io.out ?? ((s) => process.stdout.write(s + '\n'));
  const err = io.err ?? ((s) => process.stderr.write(s + '\n'));
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  } catch (e) {
    err(`error: ${e.message}`);
    return 2;
  }
  const { values: o, positionals } = parsed;
  if (o.version) { out(VERSION); return 0; }
  if (o.help) { out(USAGE); return 0; }
  if (positionals.length === 0) { err(USAGE); return 2; }
  const [cmd, ...pos] = positionals;
  try {
    const { data, text } = run(cmd, pos, o);
    out(o.json ? JSON.stringify(data, null, 2) : text);
    return 0;
  } catch (e) {
    if (e instanceof RangeError) { err(`error: ${e.message}`); return 2; }
    throw e;
  }
}
