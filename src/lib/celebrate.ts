type CelebrationLevel = "attendance" | "payment" | "newStudent" | "allPaid";

// Web Audio API 사운드 합성 (MP3 파일 불필요)
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  return new AC();
}

function playPop() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
  setTimeout(() => ctx.close(), 200);
}

function playChime() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const freqs = [523, 659, 784]; // C5, E5, G5
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime + i * 0.12;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.start(t);
    osc.stop(t + 0.5);
  });
  setTimeout(() => ctx.close(), 1000);
}

function playFanfare() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const notes = [
    { freq: 523, time: 0, dur: 0.2 },
    { freq: 659, time: 0.15, dur: 0.2 },
    { freq: 784, time: 0.3, dur: 0.2 },
    { freq: 1047, time: 0.45, dur: 0.6 },
  ];
  notes.forEach(({ freq, time, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime + time;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur);
  });
  setTimeout(() => ctx.close(), 1500);
}

const soundPlayers: Record<CelebrationLevel, () => void> = {
  attendance: playPop,
  payment: playChime,
  newStudent: playChime,
  allPaid: playFanfare,
};

async function getConfetti() {
  const mod = await import("canvas-confetti");
  return mod.default;
}

export function celebrate(level: CelebrationLevel) {
  soundPlayers[level]();

  getConfetti().then((confetti) => {
    switch (level) {
      case "attendance":
        confetti({ particleCount: 30, spread: 60, origin: { y: 0.7 } });
        break;
      case "payment":
      case "newStudent":
        confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
        break;
      case "allPaid": {
        const fire = (delay: number) =>
          setTimeout(() => {
            confetti({ particleCount: 150, spread: 100, origin: { y: 0.5 } });
          }, delay);
        fire(0);
        fire(300);
        fire(600);
        break;
      }
    }
  });
}
