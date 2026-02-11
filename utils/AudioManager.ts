
class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // Engine
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  // BGM
  private bgmInterval: number | null = null;
  private noteIndex = 0;
  private currentTrackIndex = 0;

  // State
  private initialized: boolean = false;
  private musicVolume: number = 0.5;
  private sfxVolume: number = 0.5;

  // Tracks Configuration (Procedural sequences)
  private tracks = [
    {
      name: "NEON DRIFT",
      tempo: 200,
      // D Minor Pentatonic sequence (D3, F3, G3, A3, C4)
      notes: [146.83, 174.61, 196.00, 220.00, 196.00, 174.61, 146.83, 130.81],
      type: 'sawtooth' as OscillatorType,
      filter: 800
    },
    {
      name: "CYBER ATTACK",
      tempo: 150,
      // Fast Arpeggio A Minor
      notes: [220.00, 261.63, 329.63, 440.00, 329.63, 261.63],
      type: 'square' as OscillatorType,
      filter: 1200
    },
    {
      name: "SYNTH HORIZON",
      tempo: 350,
      // Slow melodic F Major 7
      notes: [174.61, 220.00, 261.63, 329.63, 440.00, 349.23, 261.63, 220.00],
      type: 'triangle' as OscillatorType,
      filter: 600
    }
  ];

  constructor() { }

  private init() {
    if (this.initialized) return;
    try {
      // @ts-ignore
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();

      // Master
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);

      // Separate Channels
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      this.initialized = true;
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  public setMusicVolume(val: number) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
  }

  public setSfxVolume(val: number) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  public nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    if (this.bgmInterval) {
      this.stopBGM();
      this.playBGM();
    }
    return this.tracks[this.currentTrackIndex].name;
  }

  public getCurrentTrackName() {
    return this.tracks[this.currentTrackIndex].name;
  }

  public async resumeContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public playBGM() {
    this.resumeContext();
    if (!this.ctx || !this.musicGain || this.bgmInterval) return;

    const track = this.tracks[this.currentTrackIndex];

    const playNote = () => {
      if (!this.ctx || !this.musicGain) return;

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = track.type;
      osc.frequency.value = track.notes[this.noteIndex % track.notes.length];

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = track.filter;
      filter.Q.value = 1;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain!);

      osc.start(t);

      // Envelope
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (track.tempo / 1000));

      osc.stop(t + (track.tempo / 1000) + 0.1);

      this.noteIndex++;
    };

    this.bgmInterval = window.setInterval(playNote, track.tempo);
  }

  public stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  // --- GAME OVER SEQUENCE ---
  public playGameOver() {
    this.stopBGM();
    this.stopEngine();
    this.resumeContext();

    if (!this.ctx || !this.musicGain) return;

    const t = this.ctx.currentTime;

    // Play a descending sequence of low notes
    const notes = [110, 98, 87, 73]; // A2, G2, F2, D2

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      osc.connect(gain);
      gain.connect(this.musicGain!); // Use music channel for volume control

      const startTime = t + (i * 0.4);

      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.8);

      osc.start(startTime);
      osc.stop(startTime + 0.8);
    });

    // Final low boom
    const boom = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(60, t + 1.6);
    boom.frequency.exponentialRampToValueAtTime(10, t + 3.0);

    boomGain.gain.setValueAtTime(0.5, t + 1.6);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 3.0);

    boom.connect(boomGain);
    boomGain.connect(this.musicGain);

    boom.start(t + 1.6);
    boom.stop(t + 3.0);
  }

  public startEngine() {
    this.resumeContext();
    if (!this.ctx || !this.sfxGain || this.engineOsc) return;

    const t = this.ctx.currentTime;

    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(50, t);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.05, t);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150;

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineOsc.start(t);
  }

  public setEnginePitch(ratio: number) {
    if (this.engineOsc && this.ctx) {
      const targetFreq = 50 + ((ratio - 0.5) * 100);
      this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);

      if (this.engineGain) {
        const targetVol = 0.05 + ((ratio - 0.5) * 0.05);
        this.engineGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.1);
      }
    }
  }

  public stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch (e) { }
      this.engineOsc = null;
    }
    if (this.engineGain) {
      this.engineGain.disconnect();
      this.engineGain = null;
    }
  }

  public play(key: 'coin' | 'crash' | 'powerup' | 'click' | 'unlock') {
    this.resumeContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.sfxGain);

    switch (key) {
      case 'coin':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(1800, t + 0.1);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
        break;

      case 'click':
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, t);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        osc.start(t);
        osc.stop(t + 0.05);
        break;

      case 'crash':
        osc.disconnect();
        this.playNoise();
        return;

      case 'powerup':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.linearRampToValueAtTime(600, t + 0.4);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
        break;

      case 'unlock':
        this.playTone(440, t, 0.1);       // A4
        this.playTone(554.37, t + 0.1, 0.1); // C#5
        this.playTone(659.25, t + 0.2, 0.3); // E5
        break;
    }
  }

  private playTone(freq: number, startTime: number, duration: number) {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(this.sfxGain);

    gain.gain.setValueAtTime(0.2, startTime);
    gain.gain.linearRampToValueAtTime(0.01, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  private playNoise() {
    if (!this.ctx || !this.sfxGain) return;

    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.4);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start();
  }
}

export const audioManager = new AudioManager();