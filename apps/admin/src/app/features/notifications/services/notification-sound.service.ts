import { Injectable, signal } from '@angular/core';

export type NotificationSoundType = 'success' | 'warning' | 'error' | 'info';

@Injectable({
  providedIn: 'root',
})
export class NotificationSoundService {
  private soundEnabled = signal(true);
  private audioContext: AudioContext | null = null;
  private volume = signal(0.5);

  constructor() {
    this.loadSettings();
    this.initAudioContext();
  }

  private loadSettings(): void {
    const stored = localStorage.getItem('notification-sound-enabled');
    if (stored !== null) {
      this.soundEnabled.set(stored === 'true');
    }

    const volumeStored = localStorage.getItem('notification-sound-volume');
    if (volumeStored !== null) {
      this.volume.set(parseFloat(volumeStored));
    }
  }

  private initAudioContext(): void {
    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
      }
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  play(type: NotificationSoundType): void {
    if (!this.soundEnabled()) return;

    switch (type) {
      case 'success':
        this.playSuccessSound();
        break;
      case 'warning':
        this.playWarningSound();
        break;
      case 'error':
        this.playErrorSound();
        break;
      case 'info':
      default:
        this.playInfoSound();
        break;
    }
  }

  private playSuccessSound(): void {
    // Success: C-E-G chord (happy sound)
    this.playTone(262, 100); // C4
    setTimeout(() => this.playTone(330, 100), 110); // E4
    setTimeout(() => this.playTone(392, 200), 220); // G4
  }

  private playWarningSound(): void {
    // Warning: descending beep
    this.playTone(800, 150);
    setTimeout(() => this.playTone(600, 150), 160);
  }

  private playErrorSound(): void {
    // Error: low descending tones
    this.playTone(200, 100);
    setTimeout(() => this.playTone(150, 100), 110);
    setTimeout(() => this.playTone(100, 200), 220);
  }

  private playInfoSound(): void {
    // Info: single tone with slight vibrato effect
    this.playTone(440, 200);
  }

  private playTone(frequency: number, duration: number): void {
    if (!this.audioContext) {
      this.playAudioFile(frequency, duration);
      return;
    }

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(this.volume(), this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + duration / 1000
      );

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration / 1000);
    } catch (e) {
      console.error('Error playing notification sound', e);
    }
  }

  private playAudioFile(frequency: number, duration: number): void {
    // Fallback: use data URL for audio
    const audioUrl = this.generateAudioDataUrl(frequency, duration);
    const audio = new Audio(audioUrl);
    audio.volume = this.volume();
    audio.play().catch((e) => {
      console.warn('Failed to play notification sound', e);
    });
  }

  private generateAudioDataUrl(frequency: number, duration: number): string {
    // Generate simple sine wave as data URL
    const sampleRate = 44100;
    const samples = sampleRate * (duration / 1000);
    const audioData = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * 2); // Exponential decay
      audioData[i] = Math.sin(2 * Math.PI * frequency * t) * decay * this.volume();
    }

    const wavData = this.encodeWAV(audioData, sampleRate);
    return 'data:audio/wav;base64,' + this.btoa(String.fromCharCode(...new Uint8Array(wavData)));
  }

  private encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // WAV file header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // sub-chunk size
    view.setUint16(20, 1, true); // audio format (PCM)
    view.setUint16(22, 1, true); // num channels
    view.setUint32(24, sampleRate, true); // sample rate
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Convert samples to PCM
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return buffer;
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled.set(enabled);
    localStorage.setItem('notification-sound-enabled', enabled.toString());
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.volume.set(clamped);
    localStorage.setItem('notification-sound-volume', clamped.toString());
  }

  isSoundEnabled(): boolean {
    return this.soundEnabled();
  }

  getVolume(): number {
    return this.volume();
  }
}
