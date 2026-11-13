import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialWeatherState, stepWeatherState } from './weather';

test('weather transitions smoothly between clear, rain, and blizzard with grip changes', () => {
  const weather = createInitialWeatherState('clear');
  assert.equal(weather.gripMultiplier, 1.0);
  assert.equal(weather.rainIntensity, 0);

  weather.preset = 'rain';
  for (let i = 0; i < 120; i++) {
    stepWeatherState(weather, 1 / 30, i === 60 ? 0.999 : 0.1);
  }

  assert.ok(weather.rainIntensity > 0.85, `Expected rainIntensity > 0.85, got ${weather.rainIntensity}`);
  assert.ok(weather.gripMultiplier < 0.85, `Expected reduced wet grip, got ${weather.gripMultiplier}`);
  assert.equal(weather.isDark, true);

  weather.preset = 'blizzard';
  for (let i = 0; i < 120; i++) {
    stepWeatherState(weather, 1 / 30, 0);
  }
  assert.ok(weather.snowIntensity > 0.85);
  assert.ok(weather.gripMultiplier < 0.75);
});

test('auto weather cycle advances condition over time', () => {
  const weather = createInitialWeatherState('auto');
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    stepWeatherState(weather, 0.05, 0);
    seen.add(weather.condition);
  }
  assert.ok(seen.size >= 4, `Expected auto cycle to visit >= 4 conditions, saw ${seen.size}`);
});
