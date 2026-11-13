import { clamp, lerp } from './terrain';
import type { ActiveWeatherCondition, WeatherComputed, WeatherPreset } from './types';

interface WeatherTarget {
  sunElevation: number;
  sunAzimuth: number;
  sunIntensity: number;
  sunColor: [number, number, number];
  hemiSky: [number, number, number];
  hemiGround: [number, number, number];
  hemiIntensity: number;
  fogColor: [number, number, number];
  fogDensity: number;
  skyTop: [number, number, number];
  skyHorizon: [number, number, number];
  rainIntensity: number;
  snowIntensity: number;
  windStrength: number;
  wetness: number;
  gripMultiplier: number;
  isDark: boolean;
}

const WEATHER_TARGETS: Record<ActiveWeatherCondition, WeatherTarget> = {
  clear: {
    sunElevation: 0.48,
    sunAzimuth: 0.85,
    sunIntensity: 2.35,
    sunColor: [255, 232, 194],
    hemiSky: [135, 194, 248],
    hemiGround: [78, 86, 56],
    hemiIntensity: 0.85,
    fogColor: [184, 212, 236],
    fogDensity: 0.0022,
    skyTop: [46, 114, 198],
    skyHorizon: [192, 220, 242],
    rainIntensity: 0,
    snowIntensity: 0,
    windStrength: 0.18,
    wetness: 0.0,
    gripMultiplier: 1.0,
    isDark: false,
  },
  overcast: {
    sunElevation: 0.56,
    sunAzimuth: 1.15,
    sunIntensity: 1.05,
    sunColor: [212, 222, 235],
    hemiSky: [148, 164, 182],
    hemiGround: [64, 70, 62],
    hemiIntensity: 1.0,
    fogColor: [152, 166, 180],
    fogDensity: 0.0048,
    skyTop: [96, 114, 134],
    skyHorizon: [162, 174, 188],
    rainIntensity: 0,
    snowIntensity: 0,
    windStrength: 0.42,
    wetness: 0.25,
    gripMultiplier: 0.94,
    isDark: false,
  },
  rain: {
    sunElevation: 0.34,
    sunAzimuth: 1.4,
    sunIntensity: 0.72,
    sunColor: [168, 190, 218],
    hemiSky: [94, 116, 145],
    hemiGround: [42, 48, 46],
    hemiIntensity: 0.88,
    fogColor: [94, 112, 132],
    fogDensity: 0.0068,
    skyTop: [42, 58, 78],
    skyHorizon: [104, 120, 138],
    rainIntensity: 1.0,
    snowIntensity: 0,
    windStrength: 0.78,
    wetness: 1.0,
    gripMultiplier: 0.76,
    isDark: true,
  },
  blizzard: {
    sunElevation: 0.42,
    sunAzimuth: 0.55,
    sunIntensity: 0.88,
    sunColor: [224, 238, 255],
    hemiSky: [176, 196, 218],
    hemiGround: [110, 120, 132],
    hemiIntensity: 1.05,
    fogColor: [188, 202, 218],
    fogDensity: 0.0085,
    skyTop: [122, 144, 168],
    skyHorizon: [196, 208, 222],
    rainIntensity: 0,
    snowIntensity: 1.0,
    windStrength: 0.92,
    wetness: 0.4,
    gripMultiplier: 0.65,
    isDark: false,
  },
  night: {
    sunElevation: 0.28,
    sunAzimuth: -1.1,
    sunIntensity: 0.58,
    sunColor: [148, 182, 245],
    hemiSky: [38, 56, 98],
    hemiGround: [18, 22, 32],
    hemiIntensity: 0.65,
    fogColor: [16, 24, 42],
    fogDensity: 0.0044,
    skyTop: [8, 14, 30],
    skyHorizon: [26, 40, 68],
    rainIntensity: 0,
    snowIntensity: 0,
    windStrength: 0.25,
    wetness: 0.15,
    gripMultiplier: 0.96,
    isDark: true,
  },
};

function rgbToHex(r: number, g: number, b: number): number {
  const ri = clamp(Math.round(r), 0, 255);
  const gi = clamp(Math.round(g), 0, 255);
  const bi = clamp(Math.round(b), 0, 255);
  return (ri << 16) | (gi << 8) | bi;
}

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function lerpHex(hexA: number, rgbB: [number, number, number], alpha: number): number {
  const [ar, ag, ab] = hexToRgb(hexA);
  return rgbToHex(lerp(ar, rgbB[0], alpha), lerp(ag, rgbB[1], alpha), lerp(ab, rgbB[2], alpha));
}

export const AUTO_CYCLE_ORDER: ActiveWeatherCondition[] = [
  'clear',
  'overcast',
  'rain',
  'blizzard',
  'night',
];

export function createInitialWeatherState(preset: WeatherPreset = 'clear'): WeatherComputed {
  const cond: ActiveWeatherCondition = preset === 'auto' ? 'clear' : preset;
  const t = WEATHER_TARGETS[cond];
  return {
    preset,
    condition: cond,
    cycleTime: 0,
    sunElevation: t.sunElevation,
    sunAzimuth: t.sunAzimuth,
    sunIntensity: t.sunIntensity,
    sunColorHex: rgbToHex(...t.sunColor),
    hemiSkyHex: rgbToHex(...t.hemiSky),
    hemiGroundHex: rgbToHex(...t.hemiGround),
    hemiIntensity: t.hemiIntensity,
    fogColorHex: rgbToHex(...t.fogColor),
    fogDensity: t.fogDensity,
    skyTopHex: rgbToHex(...t.skyTop),
    skyHorizonHex: rgbToHex(...t.skyHorizon),
    rainIntensity: t.rainIntensity,
    snowIntensity: t.snowIntensity,
    windStrength: t.windStrength,
    windAngle: 0.65,
    wetness: t.wetness,
    gripMultiplier: t.gripMultiplier,
    lightningFlash: 0,
    isDark: t.isDark,
  };
}

export function stepWeatherState(
  state: WeatherComputed,
  rawDt: number,
  lightningSeed = 0,
): WeatherComputed {
  const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

  if (state.preset === 'auto') {
    // Full 5-stage dynamic weather cycle every ~90 seconds
    state.cycleTime = (state.cycleTime + dt / 90) % 1;
    const idx = Math.floor(state.cycleTime * AUTO_CYCLE_ORDER.length) % AUTO_CYCLE_ORDER.length;
    state.condition = AUTO_CYCLE_ORDER[idx];
  } else {
    state.condition = state.preset;
  }

  const target = WEATHER_TARGETS[state.condition];
  const alpha = 1 - Math.exp(-1.6 * dt);

  state.sunElevation = lerp(state.sunElevation, target.sunElevation, alpha);
  state.sunAzimuth = lerp(state.sunAzimuth, target.sunAzimuth, alpha);
  state.sunIntensity = lerp(state.sunIntensity, target.sunIntensity, alpha);
  state.sunColorHex = lerpHex(state.sunColorHex, target.sunColor, alpha);
  state.hemiSkyHex = lerpHex(state.hemiSkyHex, target.hemiSky, alpha);
  state.hemiGroundHex = lerpHex(state.hemiGroundHex, target.hemiGround, alpha);
  state.hemiIntensity = lerp(state.hemiIntensity, target.hemiIntensity, alpha);
  state.fogColorHex = lerpHex(state.fogColorHex, target.fogColor, alpha);
  state.fogDensity = lerp(state.fogDensity, target.fogDensity, alpha);
  state.skyTopHex = lerpHex(state.skyTopHex, target.skyTop, alpha);
  state.skyHorizonHex = lerpHex(state.skyHorizonHex, target.skyHorizon, alpha);
  state.rainIntensity = lerp(state.rainIntensity, target.rainIntensity, alpha);
  state.snowIntensity = lerp(state.snowIntensity, target.snowIntensity, alpha);
  state.windStrength = lerp(state.windStrength, target.windStrength, alpha);
  state.wetness = lerp(state.wetness, target.wetness, alpha);
  state.gripMultiplier = lerp(state.gripMultiplier, target.gripMultiplier, alpha);
  state.isDark = target.isDark;

  // Wind slowly shifts direction
  state.windAngle = (state.windAngle + dt * 0.04) % (Math.PI * 2);

  // Periodic storm lightning flash in heavy rain
  if (state.rainIntensity > 0.65) {
    if (state.lightningFlash > 0.01) {
      state.lightningFlash = Math.max(0, state.lightningFlash - dt * 4.5);
    } else if (lightningSeed > 0.994) {
      state.lightningFlash = 1.0;
    }
  } else {
    state.lightningFlash = 0;
  }

  return state;
}

export const WEATHER_LABELS: Record<WeatherPreset, string> = {
  clear: 'Golden Clear',
  overcast: 'Misty Overcast',
  rain: 'Thunderstorm',
  blizzard: 'Alpine Blizzard',
  night: 'Starlit Night',
  auto: 'Dynamic Cycle',
};
