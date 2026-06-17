// src/components/OrbCanvas.tsx
//
// The Glass-Metric "orchestration core" — a canvas of orbiting agent nodes,
// animated routing traces, particle flow, and a radial voice waveform. Ported
// from the Glass-Metric Orchestration design. The center waveform + label are
// the voice visualizer: STANDBY / LISTENING / RESPONDING / ERROR.

import { useEffect, useRef } from 'react';
import type { VoiceUiState } from '../store';

export interface OrbTheme {
  accent: string;
  accentRGB: string;
  glow: string;
  glowRGB: string;
}

interface AgentDef {
  name: string;
  icon: string;
  x: number;
  y: number;
  state: 'active' | 'idle';
  route: 'A' | 'B';
}

interface Particle {
  agentIdx: number;
  t: number;
  speed: number;
  size: number;
}

interface Props {
  uiState: VoiceUiState;
  isRunning: boolean;
  theme: OrbTheme;
}

const STATE_LABELS: Record<VoiceUiState, string> = {
  IDLE: 'STANDBY',
  USER_TALKING: 'LISTENING',
  AI_SPEAKING: 'RESPONDING',
  AGENT_ERROR: 'ERROR',
};

export default function OrbCanvas({ uiState, isRunning, theme }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Latest props for the rAF loop to read without re-subscribing.
  const propsRef = useRef<Props>({ uiState, isRunning, theme });
  propsRef.current = { uiState, isRunning, theme };

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
    let agentDefs: AgentDef[] = [];
    let particles: Particle[] = [];
    let processingTokens = 1240;
    let tokenAccum = 0;

    const buildAgents = () => {
      const r = orbitRadius;
      const PI = Math.PI;
      agentDefs = [
        { name: 'PARSE', icon: '⚙', x: cx + r * Math.cos(-PI * 0.25), y: cy + r * Math.sin(-PI * 0.25), state: 'active', route: 'B' },
        { name: 'EXEC', icon: '⚡', x: cx + r * Math.cos(PI * 0.25), y: cy + r * Math.sin(PI * 0.25), state: 'active', route: 'A' },
        { name: 'CACHE', icon: '◈', x: cx + r * Math.cos(PI * 0.75), y: cy + r * Math.sin(PI * 0.75), state: 'idle', route: 'B' },
        { name: 'MON', icon: '◉', x: cx + r * Math.cos(-PI * 0.75), y: cy + r * Math.sin(-PI * 0.75), state: 'active', route: 'A' },
      ];
    };

    const buildParticles = () => {
      particles = [];
      agentDefs.forEach((a, i) => {
        const count = a.state === 'active' ? 8 : 2;
        for (let j = 0; j < count; j++) {
          particles.push({ agentIdx: i, t: j / count, speed: 0.00012 + Math.random() * 0.00008, size: 1.5 + Math.random() * 1.5 });
        }
      });
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
      orbitRadius = Math.min(rect.width, rect.height) * 0.32;
      buildAgents();
      buildParticles();
    };

    const pathPos = (idx: number, t: number) => {
      const a = agentDefs[idx];
      const ax = a.x;
      const ay = a.y;
      if (a.route === 'B') {
        const seg1 = Math.abs(ay - cy);
        const seg2 = Math.abs(ax - cx);
        const total = seg1 + seg2;
        const dist = t * total;
        if (dist < seg1) return { x: ax, y: ay + (cy - ay) * (dist / seg1) };
        return { x: ax + (cx - ax) * ((dist - seg1) / seg2), y: cy };
      }
      const seg1 = Math.abs(ax - cx);
      const seg2 = Math.abs(ay - cy);
      const total = seg1 + seg2;
      const dist = t * total;
      if (dist < seg1) return { x: ax + (cx - ax) * (dist / seg1), y: ay };
      return { x: cx, y: ay + (cy - ay) * ((dist - seg1) / seg2) };
    };

    const drawRings = (th: OrbTheme, t: number) => {
      const r = orbitRadius;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.04);
      ctx.strokeStyle = `rgba(${th.accentRGB},.12)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 9]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const major = i % 4 === 0;
        const len = major ? 10 : 4;
        ctx.strokeStyle = `rgba(${th.accentRGB},${major ? 0.4 : 0.12})`;
        ctx.lineWidth = major ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (r * 1.55 - len), Math.sin(a) * (r * 1.55 - len));
        ctx.lineTo(Math.cos(a) * r * 1.55, Math.sin(a) * r * 1.55);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * 0.018);
      ctx.strokeStyle = `rgba(${th.accentRGB},.18)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 14]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      ctx.strokeStyle = `rgba(${th.accentRGB},.08)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([1, 8]);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.strokeStyle = `rgba(${th.accentRGB},.04)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * r * 1.55, cy + Math.sin(a) * r * 1.55);
        ctx.stroke();
      }

      // Radar sweep
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.9);
      ctx.strokeStyle = `rgba(${th.accentRGB},.5)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r * 1.45, 0);
      ctx.stroke();
      ctx.fillStyle = `rgba(${th.accentRGB},.04)`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r * 1.45, -0.5, 0, false);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const tracePath = (a: AgentDef) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      if (a.route === 'B') {
        ctx.lineTo(a.x, cy + (a.y > cy ? -6 : 6));
        ctx.arcTo(a.x, cy, a.x + (cx > a.x ? 6 : -6), cy, 6);
        ctx.lineTo(cx, cy);
      } else {
        ctx.lineTo(cx + (a.x > cx ? 6 : -6), a.y);
        ctx.arcTo(cx, a.y, cx, a.y + (cy > a.y ? 6 : -6), 6);
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    };

    const drawTraces = (th: OrbTheme, t: number, running: boolean) => {
      for (let i = 0; i < agentDefs.length; i++) {
        const a = agentDefs[i];
        const active = a.state === 'active' && running;
        ctx.strokeStyle = `rgba(${th.accentRGB},${active ? 0.35 : 0.1})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        tracePath(a);
        if (active) {
          ctx.strokeStyle = `rgba(${th.glowRGB},.45)`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 10]);
          ctx.lineDashOffset = -(t * 28 + i * 7);
          tracePath(a);
          ctx.setLineDash([]);
        }
      }
    };

    const drawParticles = (th: OrbTheme, dt: number, running: boolean) => {
      if (!running) return;
      for (const p of particles) {
        p.t += p.speed * (dt || 16);
        if (p.t >= 1) p.t -= 1;
        const agent = agentDefs[p.agentIdx];
        if (agent.state !== 'active') {
          p.t += 0.003;
          continue;
        }
        const pos = pathPos(p.agentIdx, p.t);
        const alpha = Math.sin(p.t * Math.PI) * 0.9;
        ctx.save();
        ctx.globalAlpha = alpha;
        const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, p.size * 4);
        grad.addColorStop(0, th.accent);
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

    const drawNodes = (th: OrbTheme, t: number, running: boolean) => {
      for (const a of agentDefs) {
        const active = a.state === 'active' && running;
        const pulse = (Math.sin(t * 1.8 + a.x * 0.01) + 1) / 2;
        const R = 30;
        if (active) {
          ctx.save();
          ctx.globalAlpha = 0.1 + pulse * 0.12;
          const halo = ctx.createRadialGradient(a.x, a.y, R, a.x, a.y, R + 20);
          halo.addColorStop(0, th.accent);
          halo.addColorStop(1, 'transparent');
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(a.x, a.y, R + 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        const bg = ctx.createRadialGradient(a.x - R * 0.3, a.y - R * 0.3, 0, a.x, a.y, R);
        bg.addColorStop(0, active ? `rgba(${th.accentRGB},.25)` : 'rgba(30,30,50,.8)');
        bg.addColorStop(1, 'rgba(8,8,16,.95)');
        ctx.save();
        if (active) {
          ctx.shadowBlur = 18;
          ctx.shadowColor = th.accent;
        }
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(a.x, a.y, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = active ? th.accent : '#2a2a3a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(a.x, a.y, R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = active ? th.accent : '#555';
        ctx.font = `bold 16px 'Fira Code', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(a.icon, a.x, a.y - 5);
        ctx.fillStyle = active ? '#aaa' : '#444';
        ctx.font = `bold 9px 'Fira Code', monospace`;
        ctx.fillText(a.name, a.x, a.y + 10);
      }
    };

    const drawCore = (th: OrbTheme, t: number, running: boolean, uiState: VoiceUiState) => {
      const iR = 52;
      const maxH = running ? 48 : 12;
      const numBars = 72;
      const speed = uiState === 'AI_SPEAKING' ? 1.4 : uiState === 'USER_TALKING' ? 1.1 : 0.8;
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
        g.addColorStop(0.4, `rgba(${th.accentRGB},.5)`);
        g.addColorStop(1, th.accent);
        ctx.fillStyle = g;
        ctx.fillRect(-1.2, -iR - bh, 2.4, bh);
        ctx.restore();
      }

      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, iR + 14);
      cg.addColorStop(0, `rgba(${th.accentRGB},.35)`);
      cg.addColorStop(0.6, `rgba(${th.accentRGB},.08)`);
      cg.addColorStop(1, 'transparent');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, iR + 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.shadowBlur = 28;
      ctx.shadowColor = uiState === 'AGENT_ERROR' ? '#ef4444' : th.accent;
      ctx.fillStyle = '#070710';
      ctx.beginPath();
      ctx.arc(cx, cy, iR - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = uiState === 'AGENT_ERROR' ? 'rgba(239,68,68,.8)' : `rgba(${th.accentRGB},.75)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, iR - 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      const label = running ? STATE_LABELS[uiState] : 'STANDBY';
      const stateColor = uiState === 'AGENT_ERROR' ? '#ef4444' : th.accent;
      ctx.fillStyle = stateColor;
      ctx.font = `bold 9px 'Fira Code', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy - 12);
      ctx.fillStyle = '#ccc';
      ctx.font = `bold 14px 'Fira Code', monospace`;
      ctx.fillText(Math.floor(processingTokens).toLocaleString(), cx, cy + 4);
      ctx.fillStyle = `rgba(${th.accentRGB},.4)`;
      ctx.font = `8px 'Fira Code', monospace`;
      ctx.fillText('TOKENS', cx, cy + 17);
    };

    const loop = (ts: number) => {
      frameId = requestAnimationFrame(loop);
      const dt = ts - (lastTime || ts);
      lastTime = ts;
      const { uiState, isRunning, theme } = propsRef.current;
      const t = Date.now() / 1000;

      if (isRunning) {
        tokenAccum += dt;
        if (tokenAccum > 700) {
          processingTokens += Math.random() * 40;
          tokenAccum = 0;
        }
      }

      const W = canvas.width / (window.devicePixelRatio || 1);
      const H = canvas.height / (window.devicePixelRatio || 1);
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, W, H);

      drawRings(theme, t);
      drawTraces(theme, t, isRunning);
      drawParticles(theme, dt, isRunning);
      drawNodes(theme, t, isRunning);
      drawCore(theme, t, isRunning, uiState);
    };

    resize();
    window.addEventListener('resize', resize);
    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />;
}
