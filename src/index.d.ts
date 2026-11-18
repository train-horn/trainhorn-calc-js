/**
 * trainhorn-calc: dependency-free calculators for train horn setups
 * (SPL vs distance, air tank runtime, compressor recovery, AWG by voltage drop).
 */

/** Package version. */
export declare const VERSION: string;

/** Thrown on invalid input. Subclass of RangeError. */
export declare class InputError extends RangeError {
  constructor(message: string);
  name: 'InputError';
}

/** A length unit: feet or metres. */
export type LengthUnit = 'ft' | 'm';
/** A wire gauge such as 10, "10", "10 AWG", "1/0" or "4/0". */
export type AwgLike = number | string;

/** Metres in one international foot (0.3048). */
export declare const METERS_PER_FOOT: number;
/** Accepted length units. */
export declare const LENGTH_UNITS: readonly LengthUnit[];

/** Options for {@link splAtDistance} and {@link distanceForSpl}. */
export interface SplOptions {
  /** Distance at which the source level applies (> 0). Default 10. */
  refDistance?: number;
  /** Unit for all distances. Default "ft". */
  unit?: LengthUnit;
  /** Optional air absorption in dB/km (>= 0). Default 0. */
  absorptionDbPerKm?: number;
}

/** Approximate air absorption in dB/km at 10 degC / 70 % RH, keyed by octave band (Hz). */
export declare const AIR_ABSORPTION_DB_PER_KM: Readonly<Record<number, number>>;

/** SPL at `distance` from a level known at the reference distance. `splAtDistance(150, 100) === 130`. */
export declare function splAtDistance(sourceDb: number, distance: number, options?: SplOptions): number;
/** Distance at which the level falls to `targetDb`; inverse of {@link splAtDistance}. */
export declare function distanceForSpl(sourceDb: number, targetDb: number, options?: SplOptions): number;
/** Level change in dB for a distance ratio: 20*log10(ratio). */
export declare function distanceRatioLoss(ratio: number): number;
/** Free-field loss per doubling of distance (about 6.02 dB). */
export declare function dbDoublingLoss(): number;
/** Combine incoherent levels: 10*log10(sum(10^(L/10))). */
export declare function combineLevels(levelsDb: Iterable<number>): number;

/** Standard atmosphere at sea level in psi (14.696). */
export declare const ATMOSPHERIC_PSI: number;
/** Cubic feet per US gallon (231/1728). */
export declare const CUBIC_FEET_PER_GALLON: number;

/** Free air (cu ft at atmospheric pressure) released between two gauge pressures. */
export declare function freeAirVolumeCuft(
  tankGallons: number,
  startPsi: number,
  endPsi: number,
  atmosphericPsi?: number,
): number;
/** Seconds of continuous horn time from startPsi down to cutoffPsi. */
export declare function tankRuntimeSeconds(
  tankGallons: number,
  startPsi: number,
  cutoffPsi: number,
  hornCfm: number,
  atmosphericPsi?: number,
): number;
/** Whole blasts of blastSeconds that fit in runtimeSeconds. */
export declare function blastCount(runtimeSeconds: number, blastSeconds: number): number;

/** Options for {@link compressorRecoverySeconds}. */
export interface RecoveryOptions {
  /** Free-air CFM at 0 psi (enables the linear-flow model; needs ratedPsi). */
  cfmAtZeroPsi?: number;
  /** Pressure at which compressorCfm is rated (needs cfmAtZeroPsi). */
  ratedPsi?: number;
  /** Ambient absolute pressure in psi. Default 14.696. */
  atmosphericPsi?: number;
}
/** Seconds for a compressor to refill from cutInPsi to cutOutPsi. */
export declare function compressorRecoverySeconds(
  tankGallons: number,
  cutInPsi: number,
  cutOutPsi: number,
  compressorCfm: number,
  options?: RecoveryOptions,
): number;

/** Copper resistivity at 20 degC (ohm*m). */
export declare const COPPER_RESISTIVITY_OHM_M: number;
/** Copper temperature coefficient (per degC). */
export declare const COPPER_TEMP_COEFF_PER_C: number;
/** Gauges considered by {@link suggestAwg}, thinnest to thickest. */
export declare const AWG_SIZES: readonly string[];

/** Options for {@link voltageDrop}. */
export interface WireOptions {
  /** Unit of the one-way length. Default "ft". */
  unit?: LengthUnit;
  /** Conductor temperature in degC (-60..200). Default 20. */
  temperatureC?: number;
}
/** Options for {@link suggestAwg}. */
export interface SuggestOptions extends WireOptions {
  /** Nominal system voltage. Default 12. */
  systemVoltage?: number;
  /** Allowed drop in percent (0 < x <= 50). Default 3. */
  maxDropPct?: number;
}
/** Result of {@link suggestAwg}. */
export interface WireSuggestion {
  awg: string;
  voltageDropV: number;
  voltageDropPct: number;
  allowedDropPct: number;
  systemVoltage: number;
  amps: number;
  oneWayLength: number;
  unit: LengthUnit;
}

/** Bare conductor diameter in mm. */
export declare function awgDiameterMm(awg: AwgLike): number;
/** Conductor area in mm^2. */
export declare function awgAreaMm2(awg: AwgLike): number;
/** Copper resistance in ohms per 1000 ft. */
export declare function awgResistanceOhmPer1000ft(awg: AwgLike, temperatureC?: number): number;
/** Round-trip voltage drop in volts. */
export declare function voltageDrop(amps: number, oneWayLength: number, awg: AwgLike, options?: WireOptions): number;
/** Smallest copper AWG meeting the voltage-drop budget. */
export declare function suggestAwg(amps: number, oneWayLength: number, options?: SuggestOptions): WireSuggestion;
