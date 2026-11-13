import { clamp } from './terrain';
import type { SurfaceType, VehicleState, WeatherComputed } from './types';

export class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  private skidFilter: BiquadFilterNode | null = null;
  private skidGain: GainNode | null = null;

  private weatherFilter: BiquadFilterNode | null = null;
  private weatherGain: GainNode | null = null;

  private muted = false;
  private started = false;
  private lastThunderFlash = 0;

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.42, this.ctx.currentTime, 0.04);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  initOnGesture(): void {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.42;
      master.connect(ctx.destination);
      this.masterGain = master;

      // Engine harmonic pair
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.value = 55;
      osc2.frequency.value = 110;

      const engFilter = ctx.createBiquadFilter();
      engFilter.type = 'lowpass';
      engFilter.frequency.value = 260;
      engFilter.Q.value = 2.5;

      const engGain = ctx.createGain();
      engGain.gain.value = 0.0;

      osc1.connect(engFilter);
      osc2.connect(engFilter);
      engFilter.connect(engGain);
      engGain.connect(master);

      osc1.start();
      osc2.start();

      this.engineOsc1 = osc1;
      this.engineOsc2 = osc2;
      this.engineFilter = engFilter;
      this.engineGain = engGain;

      // Shared white-noise buffer for tire skid + weather rain/wind
      const bufLen = ctx.sampleRate * 2;
      const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      // Tire skid / gravel noise
      const skidSrc = ctx.createBufferSource();
      skidSrc.buffer = noiseBuf;
      skidSrc.loop = true;
      const skidFilter = ctx.createBiquadFilter();
      skidFilter.type = 'bandpass';
      skidFilter.frequency.value = 1150;
      skidFilter.Q.value = 3.2;
      const skidGain = ctx.createGain();
      skidGain.gain.value = 0;
      skidSrc.connect(skidFilter);
      skidFilter.connect(skidGain);
      skidGain.connect(master);
      skidSrc.start();
      this.skidFilter = skidFilter;
      this.skidGain = skidGain;

      // Weather rain / wind noise
      const wSrc = ctx.createBufferSource();
      wSrc.buffer = noiseBuf;
      wSrc.loop = true;
      const wFilter = ctx.createBiquadFilter();
      wFilter.type = 'lowpass';
      wFilter.frequency.value = 800;
      const wGain = ctx.createGain();
      wGain.gain.value = 0;
      wSrc.connect(wFilter);
      wFilter.connect(wGain);
      wGain.connect(master);
      wSrc.start();
      this.weatherFilter = wFilter;
      this.weatherGain = wGain;

      this.started = true;
    } catch {
      // Ignore Web Audio restriction errors in headless mode
    }
  }

  silenceLoops(): void {
    if (!this.ctx || !this.started) return;
    const t = this.ctx.currentTime;
    this.engineGain?.gain.setTargetAtTime(0, t, 0.05);
    this.skidGain?.gain.setTargetAtTime(0, t, 0.05);
    this.weatherGain?.gain.setTargetAtTime(0, t, 0.05);
  }

  update(vehicle: VehicleState, weather: WeatherComputed, active: boolean): void {
    if (!this.ctx || !this.started) return;
    if (!active || this.muted) {
      this.silenceLoops();
      return;
    }

    const t = this.ctx.currentTime;
    const rpmNorm = clamp((vehicle.rpm - 850) / 7400, 0, 1);
    const baseFreq = 42 + rpmNorm * 145 + (vehicle.isBoosting ? 24 : 0);

    this.engineOsc1?.frequency.setTargetAtTime(baseFreq, t, 0.04);
    this.engineOsc2?.frequency.setTargetAtTime(baseFreq * 1.98, t, 0.04);
    this.engineFilter?.frequency.setTargetAtTime(
      240 + rpmNorm * 1350 + (vehicle.isBoosting ? 500 : 0),
      t,
      0.05,
    );
    this.engineGain?.gain.setTargetAtTime(0.08 + rpmNorm * 0.11, t, 0.05);

    // Tire slip / off-road gravel audio
    let maxSlip = 0;
    for (let i = 0; i < 4; i++) {
      if (vehicle.wheels[i].grounded && vehicle.wheels[i].slip > maxSlip) {
        maxSlip = vehicle.wheels[i].slip;
      }
    }
    const speedFactor = clamp(Math.abs(vehicle.speed) / 22, 0, 1);
    const isAsphalt = vehicle.surface === 'asphalt';
    const offroadRumble = !isAsphalt && vehicle.groundedCount > 0 ? speedFactor * 0.09 : 0;
    const skidVol = (vehicle.isDrifting ? 0.16 : maxSlip * 0.1) * speedFactor + offroadRumble;

    this.skidFilter?.frequency.setTargetAtTime(
      isAsphalt ? 1350 + maxSlip * 450 : surfaceFilterFreq(vehicle.surface),
      t,
      0.06,
    );
    this.skidGain?.gain.setTargetAtTime(clamp(skidVol, 0, 0.24), t, 0.04);

    // Weather rain & wind ambience
    const rainVol = weather.rainIntensity * 0.16 + weather.windStrength * 0.06;
    this.weatherFilter?.frequency.setTargetAtTime(
      450 + weather.rainIntensity * 2200 + weather.windStrength * 500,
      t,
      0.1,
    );
    this.weatherGain?.gain.setTargetAtTime(clamp(rainVol, 0, 0.24), t, 0.12);

    // Impacts & landing thud
    if (vehicle.impactIntensity > 0.15) {
      this.playImpact(vehicle.impactIntensity);
    }
    if (vehicle.landedIntensity > 0.2) {
      this.playImpact(vehicle.landedIntensity * 0.7);
    }

    // Thunder clap when lightning spikes
    if (weather.lightningFlash > 0.85 && this.lastThunderFlash <= 0.85) {
      this.playThunder();
    }
    this.lastThunderFlash = weather.lightningFlash;
  }

  playImpact(intensity: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(115, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.18);
    gain.gain.setValueAtTime(clamp(intensity * 0.35, 0.05, 0.38), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.21);
  }

  playCoinChime(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [987.77, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const start = now + idx * 0.055;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  }

  playBeaconChime(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + idx * 0.07;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(start);
      osc.stop(start + 0.44);
    });
  }

  private playThunder(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 1.4);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.55);
  }

  dispose(): void {
    try {
      this.engineOsc1?.stop();
      this.engineOsc2?.stop();
      if (this.ctx && this.ctx.state !== 'closed') {
        void this.ctx.close();
      }
    } catch {
      // ignore
    }
    this.started = false;
  }
}

function surfaceFilterFreq(surface: SurfaceType): number {
  switch (surface) {
    case 'dirt':
    case 'rock':
      return 650;
    case 'water':
      return 1400;
    case 'snow':
    case 'sand':
      return 500;
    default:
      return 420;
  }
}
