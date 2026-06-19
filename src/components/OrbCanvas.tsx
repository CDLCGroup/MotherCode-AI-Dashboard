// src/components/OrbCanvas.tsx
//
// The Z.E.R.O. "neural constellation" core. Real agent domains are rendered as
// region-colored brain nodes scattered around a glowing brainstem core, wired to
// the core by faint axons with travelling synaptic pulses, over a twinkling
// neuron starfield. The center is the live voice visualizer: STANDBY / LISTENING
// / RESPONDING / ERROR. Adapted from the Glass-Metric orchestration core — same
// rAF loop, resize/DPR handling and core+label+token machinery.

import { useEffect, useRef } from 'react';
import type { VoiceUiState } from '../store';
import type { OrbTheme } from '../theme';
import { REGIONS } from '../theme';

interface NeuralNode {
  label: string;
  region: string;
  x: number;
  y: number;
  color: string;
  rgb: string;
  fire: number; // decorative firing-rate label
  active: boolean;
}

interface Particle {
  nodeIdx: number;
  t: number;
  speed: number;
  size: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  rgb: string;
}

interface Props {
  uiState: VoiceUiState;
  isRunning: boolean;
  theme: OrbTheme;
  domains: string[];
}

const STATE_LABELS: Record<VoiceUiState, string> = {
  IDLE: 'STANDBY',
  USER_TALKING: 'LISTENING',
  AI_SPEAKING: 'RESPONDING',
  AGENT_ERROR: 'FLAGGED',
};

// Deterministic pseudo-random in [0,1) from an integer seed (no Math.random in
// layout so node positions/fire-rates are stable across frames).
function seed(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export default function OrbCanvas({ uiState, isRunning, theme, domains }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef<Props>({ uiState, isRunning, theme, domains });
  propsRef.current = { uiState, isRunning, theme, domains };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId = 0;
    let lastTime = 0;
    let cx = 0;
    let cy = 0;
    let orbitRadius = 0;
    let nodes: NeuralNode[] = [];
    let particles: Particle[] = [];
    let stars: Star[] = [];
    let processingTokens = 1240;
    let tokenAccum = 0;
    let builtFor = ''; // domains signature the current nodes were built for

    const buildNodes = (doms: string[], running: boolean) => {
      const r = orbitRadius;
      const n = Math.max(doms.length, 1);
      nodes = doms.map((d, i) => {
        const reg = REGIONS[i % REGIONS.length];
        // Even spokes with a deterministic organic jitter in angle + radius.
        const baseAngle = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const angle = baseAngle + (seed(i + 1) - 0.5) * 0.5;
        const rad = r * (0.78 + seed(i + 7) * 0.5);
        return {
          label: d.replace(/_/g, ' ').toUpperCase(),
          region: reg.name,
          x: cx + Math.cos(angle) * rad,
          y: cy + Math.sin(angle) * rad,
          color: reg.color,
          rgb: reg.rgb,
          fire: 120 + Math.floor(seed(i + 3) * 380),
          active: running,
        };
      });
    };

    const buildParticles = () => {
      particles = [];
      nodes.forEach((nd, i) => {
        const count = nd.active ? 5 : 1;
        for (let j = 0; j < count; j++) {
          particles.push({ nodeIdx: i, t: j / count, speed: 0.00014 + seed(i * 10 + j) * 0.0001, size: 1.4 + seed(i + j) * 1.6 });
        }
      });
    };

    const buildStars = () => {
      const w = cx * 2;
      const h = cy * 2;
      const count = Math.round((w * h) / 7000); // density
      stars = [];
      for (let i = 0; i < count; i++) {
        const reg = REGIONS[i % REGIONS.length];
        stars.push({
          x: seed(i + 0.1) * w,
          y: seed(i + 0.7) * h,
          r: 0.4 + seed(i + 1.3) * 1.3,
          phase: seed(i + 2.9) * Math.PI * 2,
          // Most neurons are dim cyan; a few flash a region color.
          rgb: seed(i + 4.4) > 0.86 ? reg.rgb : theme.accentRGB,
        });
      }
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      cx = rect.width / 2;
      cy = rect.height / 2;
      orbitRadius = Math.min(rect.width, rect.height) * 0.34;
      const { domains, isRunning } = propsRef.current;
      buildNodes(domains, isRunning);
      buildParticles();
      buildStars();
      builtFor = domains.join(',') + '|' + isRunning;
    };

    // Straight axon from node to core.
    const pathPos = (idx: number, t: number) => {
      const nd = nodes[idx];
      return { x: nd.x + (cx - nd.x) * t, y: nd.y + (cy - nd.y) * t };
    };

    const drawStars = (t: number) => {
      for (const s of stars) {
        const tw = (Math.sin(t * 1.6 + s.phase) + 1) / 2;
        ctx.globalAlpha = 0.12 + tw * 0.4;
        ctx.fillStyle = `rgb(${s.rgb})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const drawRings = (th: OrbTheme, t: number) => {
      const r = orbitRadius;
      // Faint outer dashed boundary slowly rotating.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.03);
      ctx.strokeStyle = `rgba(${th.accentRGB},.10)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 12]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Inner field grid ring.
      ctx.strokeStyle = `rgba(${th.accentRGB},.06)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([1, 9]);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawAxons = (th: OrbTheme, t: number, running: boolean) => {
      // Inter-node web (synaptic mesh) — very faint.
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          if (Math.hypot(dx, dy) > orbitRadius * 1.15) continue;
          ctx.strokeStyle = `rgba(${th.accentRGB},.05)`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      // Axon from each node to the core, tinted by region.
      for (let i = 0; i < nodes.length; i++) {
        const nd = nodes[i];
        const active = nd.active && running;
        ctx.strokeStyle = `rgba(${nd.rgb},${active ? 0.28 : 0.1})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(nd.x, nd.y);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        if (active) {
          ctx.strokeStyle = `rgba(${nd.rgb},.5)`;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 12]);
          ctx.lineDashOffset = -(t * 26 + i * 6);
          ctx.beginPath();
          ctx.moveTo(nd.x, nd.y);
          ctx.lineTo(cx, cy);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    };

    const drawParticles = (dt: number, running: boolean) => {
      if (!running) return;
      for (const p of particles) {
        const nd = nodes[p.nodeIdx];
        if (!nd) continue;
        p.t += p.speed * (dt || 16);
        if (p.t >= 1) p.t -= 1;
        if (!nd.active) {
          p.t += 0.003;
          continue;
        }
        const pos = pathPos(p.nodeIdx, p.t);
        const alpha = Math.sin(p.t * Math.PI) * 0.9;
        ctx.save();
        ctx.globalAlpha = alpha;
        const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, p.size * 4);
        grad.addColorStop(0, nd.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, p.size * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, p.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    const drawNodes = (t: number, running: boolean) => {
      for (const nd of nodes) {
        const active = nd.active && running;
        const pulse = (Math.sin(t * 1.8 + nd.x * 0.01) + 1) / 2;
        const R = 24;
        if (active) {
          ctx.save();
          ctx.globalAlpha = 0.1 + pulse * 0.14;
          const halo = ctx.createRadialGradient(nd.x, nd.y, R, nd.x, nd.y, R + 22);
          halo.addColorStop(0, nd.color);
          halo.addColorStop(1, 'transparent');
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(nd.x, nd.y, R + 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        const bg = ctx.createRadialGradient(nd.x - R * 0.3, nd.y - R * 0.3, 0, nd.x, nd.y, R);
        bg.addColorStop(0, active ? `rgba(${nd.rgb},.22)` : 'rgba(18,28,38,.85)');
        bg.addColorStop(1, 'rgba(4,7,15,.95)');
        ctx.save();
        if (active) {
          ctx.shadowBlur = 16;
          ctx.shadowColor = nd.color;
        }
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(nd.x, nd.y, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = active ? nd.color : '#1d3540';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(nd.x, nd.y, R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Region core dot.
        ctx.fillStyle = active ? nd.color : '#33505c';
        ctx.beginPath();
        ctx.arc(nd.x, nd.y - 3, 3.2, 0, Math.PI * 2);
        ctx.fill();

        // Label: domain name + decorative firing rate.
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = active ? '#d8efef' : '#5a7681';
        ctx.font = `600 8.5px 'JetBrains Mono', monospace`;
        ctx.fillText(nd.label, nd.x, nd.y + 9);
        ctx.fillStyle = active ? `rgba(${nd.rgb},.8)` : '#3a5862';
        ctx.font = `7px 'JetBrains Mono', monospace`;
        ctx.fillText(`ƒ ${nd.fire}/s`, nd.x, nd.y + 19);
      }
    };

    const drawCore = (th: OrbTheme, t: number, running: boolean, uiState: VoiceUiState) => {
      const iR = 50;
      const maxH = running ? 46 : 11;
      const numBars = 72;
      const speed = uiState === 'AI_SPEAKING' ? 1.4 : uiState === 'USER_TALKING' ? 1.1 : 0.8;
      const err = uiState === 'AGENT_ERROR';
      for (let i = 0; i < numBars; i++) {
        const angle = (i / numBars) * Math.PI * 2 - Math.PI / 2;
        const bh = Math.max(
          3,
          (Math.sin(t * 2.2 * speed + i * 0.38) * 0.28 +
            Math.sin(t * 3.8 * speed + i * 0.82) * 0.22 +
            Math.sin(t * 5.4 * speed + i * 1.18) * 0.12 +
            Math.sin(t * 1.1 * speed + i * 0.22) * 0.16 +
            0.5) *
            maxH,
        );
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        const g = ctx.createLinearGradient(0, -iR - bh, 0, -iR);
        g.addColorStop(0, `rgba(${th.glowRGB},0)`);
        g.addColorStop(0.4, `rgba(${err ? '255,35,53' : th.accentRGB},.5)`);
        g.addColorStop(1, err ? '#ff2335' : th.accent);
        ctx.fillStyle = g;
        ctx.fillRect(-1.2, -iR - bh, 2.4, bh);
        ctx.restore();
      }

      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, iR + 16);
      cg.addColorStop(0, `rgba(${th.accentRGB},.4)`);
      cg.addColorStop(0.6, `rgba(${th.accentRGB},.08)`);
      cg.addColorStop(1, 'transparent');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, iR + 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.shadowBlur = 30;
      ctx.shadowColor = err ? '#ff2335' : th.accent;
      ctx.fillStyle = '#04070f';
      ctx.beginPath();
      ctx.arc(cx, cy, iR - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = err ? 'rgba(255,35,53,.85)' : `rgba(${th.accentRGB},.8)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, iR - 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Bright synapse core.
      const core = ctx.createRadialGradient(cx, cy - 2, 0, cx, cy - 2, 16);
      core.addColorStop(0, '#ffffff');
      core.addColorStop(0.4, err ? '#ff6675' : th.accent);
      core.addColorStop(1, 'transparent');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 16, 0, Math.PI * 2);
      ctx.fill();

      const label = running ? STATE_LABELS[uiState] : 'STANDBY';
      const stateColor = err ? '#ff2335' : th.accent;
      ctx.fillStyle = stateColor;
      ctx.font = `700 9px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy + 14);
      ctx.fillStyle = '#cfe7e7';
      ctx.font = `700 13px 'JetBrains Mono', monospace`;
      ctx.fillText(Math.floor(processingTokens).toLocaleString(), cx, cy + 28);
      ctx.fillStyle = `rgba(${th.accentRGB},.45)`;
      ctx.font = `7px 'JetBrains Mono', monospace`;
      ctx.fillText('SYNAPSES', cx, cy + 39);
    };

    const loop = (ts: number) => {
      frameId = requestAnimationFrame(loop);
      const dt = ts - (lastTime || ts);
      lastTime = ts;
      const { uiState, isRunning, theme, domains } = propsRef.current;
      const t = Date.now() / 1000;

      // Rebuild nodes when the domain set or running flag changes.
      const sig = domains.join(',') + '|' + isRunning;
      if (sig !== builtFor && orbitRadius > 0) {
        buildNodes(domains, isRunning);
        buildParticles();
        builtFor = sig;
      }

      if (isRunning) {
        tokenAccum += dt;
        if (tokenAccum > 700) {
          processingTokens += seed(Math.floor(ts)) * 40;
          tokenAccum = 0;
        }
      }

      const W = canvas.width / (window.devicePixelRatio || 1);
      const H = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, W, H);

      drawStars(t);
      drawRings(theme, t);
      drawAxons(theme, t, isRunning);
      drawParticles(dt, isRunning);
      drawNodes(t, isRunning);
      drawCore(theme, t, isRunning, uiState);
    };

    resize();
    window.addEventListener('resize', resize);
    // Re-center when the parent box changes size without a window resize
    // (mobile stack / rail collapse / orientation) — otherwise cx/cy/orbitRadius
    // go stale and the constellation renders off-centre or stretched.
    let ro: ResizeObserver | null = null;
    if (canvas.parentElement && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => resize());
      ro.observe(canvas.parentElement);
    }
    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      ro?.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />;
}
