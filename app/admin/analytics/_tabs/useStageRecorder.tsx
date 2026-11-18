"use client";
/**
 * 당첨 발표 영상 — 확정된 당첨자로 9:16(1080×1920) 발표 영상을 만들고 그대로 녹화한다.
 * 화면 공유 권한 없이 canvas.captureStream + MediaRecorder 만 사용(60fps · 고비트레이트).
 * Chrome 계열은 mp4(H.264)로, 지원하지 않으면 webm으로 저장된다.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const W = 1080;
const H = 1920;
const FONT = '"Pretendard", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif';
const COLORS = ["#E5541B", "#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#ffffff"];
const ORANGE = "#E5541B";

export interface StageWinner {
  label: string;
  user: string;
}

type Phase = "intro" | "roll" | "reveal" | "outro";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  c: string;
  a: number;
  va: number;
}

interface Live {
  phase: Phase;
  phaseAt: number;
  title: string;
  label: string;
  name: string;
  index: number;
  total: number;
  winners: StageWinner[];
  particles: Particle[];
}

const ease = {
  out: (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3),
  back: (t: number) => {
    const x = Math.min(Math.max(t, 0), 1);
    const c1 = 1.9;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  },
};

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight = 800) {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && s > 30) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${FONT}`;
  }
  return s;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const lines: string[] = [];
  let cur = "";
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxW && cur) {
      lines.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + "…";
  }
  return lines;
}

/** 피드 이미지를 흐리게 처리해 배경용 캔버스로 미리 만들어 둔다 (cover 맞춤 + 어두운 막) */
function buildBg(img: HTMLImageElement, blurPx: number): HTMLCanvasElement {
  const M = 0.14; // 블러 가장자리 번짐 방지용 여유
  const cw = Math.round(W * (1 + M));
  const ch = Math.round(H * (1 + M));
  const cv = document.createElement("canvas");
  cv.width = cw;
  cv.height = ch;
  const ctx = cv.getContext("2d")!;
  const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  const hasFilter = typeof (ctx as { filter?: unknown }).filter === "string";
  if (hasFilter) {
    ctx.filter = `blur(${blurPx}px) saturate(1.1)`;
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    ctx.filter = "none";
  } else {
    // 필터 미지원 브라우저: 축소 후 확대로 흐림 효과
    const k = Math.max(6, Math.round(blurPx / 2));
    const sm = document.createElement("canvas");
    sm.width = Math.round(cw / k);
    sm.height = Math.round(ch / k);
    sm.getContext("2d")!.drawImage(img, (cw - dw) / 2 / k, (ch - dh) / 2 / k, dw / k, dh / k);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sm, 0, 0, cw, ch);
  }
  // 글자가 잘 보이도록 어두운 막
  const g = ctx.createLinearGradient(0, 0, 0, ch);
  g.addColorStop(0, "rgba(8,12,24,0.62)");
  g.addColorStop(0.5, "rgba(8,12,24,0.50)");
  g.addColorStop(1, "rgba(8,12,24,0.72)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);
  return cv;
}

function background(ctx: CanvasRenderingContext2D, now: number, bg: HTMLCanvasElement | null) {
  if (bg) {
    // 아주 천천히 확대·이동(켄 번즈) — 정지 화면 느낌을 줄인다
    const z = 1 + 0.035 + Math.sin(now / 5200) * 0.03;
    const dw = bg.width / (1 + 0.14) * z;
    const dh = bg.height / (1 + 0.14) * z;
    ctx.drawImage(bg, (W - dw) / 2 + Math.sin(now / 7000) * 18, (H - dh) / 2 + Math.cos(now / 6500) * 18, dw, dh);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a0f1c");
    g.addColorStop(0.55, "#131c33");
    g.addColorStop(1, "#1b2540");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // 천천히 움직이는 은은한 빛무리
  const blobs = [
    { x: 0.2, y: 0.25, r: 520, c: "229,84,27", s: 0.00021 },
    { x: 0.85, y: 0.55, r: 480, c: "96,165,250", s: 0.00017 },
    { x: 0.35, y: 0.85, r: 560, c: "167,139,250", s: 0.00013 },
  ];
  for (const b of blobs) {
    const cx = (b.x + Math.sin(now * b.s) * 0.08) * W;
    const cy = (b.y + Math.cos(now * b.s * 1.3) * 0.05) * H;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, b.r);
    rg.addColorStop(0, `rgba(${b.c},0.20)`);
    rg.addColorStop(1, `rgba(${b.c},0)`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
  // 비네팅
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function header(ctx: CanvasRenderingContext2D, live: Live) {
  ctx.textAlign = "center";
  ctx.fillStyle = ORANGE;
  ctx.font = `900 44px ${FONT}`;
  ctx.fillText("W O R K U P", W / 2, 132);
  ctx.fillStyle = "rgba(226,232,240,0.95)";
  ctx.font = `700 52px ${FONT}`;
  const tl = wrapLines(ctx, live.title, W - 180, 2);
  tl.forEach((l, i) => ctx.fillText(l, W / 2, 224 + i * 70));
}

function confetti(ctx: CanvasRenderingContext2D, live: Live) {
  for (const p of live.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.045;
    p.a += p.va;
    if (p.y > H + 40) {
      p.y = -30;
      p.x = Math.random() * W;
      p.vy = 3 + Math.random() * 5;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.scale(1, Math.cos(p.a * 1.7));
    ctx.fillStyle = p.c;
    ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
    ctx.restore();
  }
}

function winnerList(ctx: CanvasRenderingContext2D, list: StageWinner[], top: number, bottom: number, big: boolean, now: number, fadeFrom = 0) {
  if (!list.length) return;
  const n = list.length;
  const cols = big && n > 8 ? 2 : 1;
  const perCol = Math.ceil(n / cols);
  const rowH = Math.min(big ? 118 : 96, (bottom - top) / perCol);
  const colW = (W - 160) / cols;
  list.forEach((w, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const x = 80 + col * colW;
    const y = top + row * rowH;
    const a = fadeFrom ? ease.out((now - fadeFrom - i * 90) / 450) : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, (1 - a) * 24);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    rr(ctx, x, y, colW - (cols > 1 ? 16 : 0), rowH - 12, 18);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = "#fbbf24";
    ctx.font = `800 ${cols > 1 ? 28 : 32}px ${FONT}`;
    ctx.fillText(w.label, x + 26, y + (rowH - 12) / 2 + 11);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    const nm = "@" + w.user;
    const sz = fitText(ctx, nm, colW - (cols > 1 ? 250 : 330), cols > 1 ? 34 : 42, 800);
    ctx.font = `800 ${sz}px ${FONT}`;
    ctx.fillText(nm, x + colW - (cols > 1 ? 42 : 26), y + (rowH - 12) / 2 + 13);
    ctx.restore();
  });
  ctx.textAlign = "center";
}

function paint(ctx: CanvasRenderingContext2D, live: Live, now: number, bg: HTMLCanvasElement | null) {
  background(ctx, now, bg);
  ctx.textAlign = "center";
  const t = now - live.phaseAt;

  if (live.phase === "intro") {
    const a = ease.out(t / 700);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, (1 - a) * 40);
    ctx.font = `900 150px ${FONT}`;
    ctx.fillText("🎁", W / 2, 760);
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 96px ${FONT}`;
    ctx.fillText("당첨자 발표", W / 2, 940);
    ctx.fillStyle = ORANGE;
    ctx.fillRect(W / 2 - 70, 985, 140, 8);
    ctx.fillStyle = "rgba(226,232,240,0.95)";
    ctx.font = `700 54px ${FONT}`;
    wrapLines(ctx, live.title, W - 200, 3).forEach((l, i) => ctx.fillText(l, W / 2, 1090 + i * 74));
    ctx.restore();
    return;
  }

  if (live.phase === "outro") {
    header(ctx, live);
    ctx.fillStyle = "#fbbf24";
    ctx.font = `900 76px ${FONT}`;
    ctx.save();
    ctx.globalAlpha = ease.out(t / 500);
    ctx.fillText("🎉 당첨을 축하합니다 🎉", W / 2, 440);
    ctx.restore();
    winnerList(ctx, live.winners, 520, 1760, true, now, live.phaseAt);
    ctx.fillStyle = "rgba(148,163,184,0.9)";
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText("DM으로 배송 정보를 보내 주세요", W / 2, 1850);
    confetti(ctx, live);
    return;
  }

  // roll / reveal
  header(ctx, live);

  // 진행 표시
  ctx.fillStyle = "rgba(148,163,184,0.9)";
  ctx.font = `700 36px ${FONT}`;
  ctx.fillText(`${Math.min(live.index + 1, live.total)} / ${live.total}`, W / 2, 400);

  // 상품 라벨(알약)
  ctx.font = `800 54px ${FONT}`;
  const lw = ctx.measureText(live.label).width + 90;
  ctx.fillStyle = ORANGE;
  rr(ctx, W / 2 - lw / 2, 480, lw, 96, 48);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(live.label, W / 2, 546);

  // 이름 카드
  const reveal = live.phase === "reveal";
  const pop = reveal ? ease.back(t / 550) : 1;
  const sc = reveal ? 0.88 + 0.12 * pop : 1;
  const cy = 760;
  ctx.save();
  ctx.translate(W / 2, cy);
  ctx.scale(sc, sc);
  if (reveal) {
    ctx.shadowColor = "rgba(229,84,27,0.75)";
    ctx.shadowBlur = 70;
  }
  ctx.fillStyle = reveal ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)";
  rr(ctx, -450, -92, 900, 184, 36);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = reveal ? 5 : 2;
  ctx.strokeStyle = reveal ? "#fbbf24" : "rgba(255,255,255,0.18)";
  rr(ctx, -450, -92, 900, 184, 36);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  const size = fitText(ctx, live.name, 820, 104, 900);
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.fillText(live.name, 0, size * 0.34);
  ctx.restore();

  // 확정 순간 빛 퍼짐
  if (reveal && t < 700) {
    const k = t / 700;
    ctx.strokeStyle = `rgba(251,191,36,${0.8 * (1 - k)})`;
    ctx.lineWidth = 8;
    rr(ctx, -450 + W / 2 - k * 60, cy - 92 - k * 60, 900 + k * 120, 184 + k * 120, 36 + k * 40);
    ctx.stroke();
  }

  // 지금까지 발표된 당첨자
  if (live.winners.length) {
    ctx.fillStyle = "rgba(148,163,184,0.9)";
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText("발표된 당첨자", W / 2, 1010);
    winnerList(ctx, live.winners.slice(-7), 1050, 1860, false, now);
  }
  if (reveal && t < 1800) confetti(ctx, live);
}

export function useStageRecorder() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<Live>({ phase: "intro", phaseAt: 0, title: "", label: "", name: "", index: 0, total: 0, winners: [], particles: [] });
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [video, setVideo] = useState<{ url: string; ext: string } | null>(null);
  const [error, setError] = useState("");
  // 시작 전 설정 단계(배경 이미지 선택) + 배경
  const [setup, setSetup] = useState(false);
  const pending = useRef<{ title: string; winners: StageWinner[]; pool?: string[] } | null>(null);
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  const bgImg = useRef<HTMLImageElement | null>(null);
  const [bgName, setBgName] = useState("");
  const [blur, setBlur] = useState(34);

  const supported = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && "captureStream" in HTMLCanvasElement.prototype;

  const rebuildBg = useCallback((px: number) => {
    bgRef.current = bgImg.current ? buildBg(bgImg.current, px) : null;
  }, []);
  /** 배경 이미지 선택 (피드에 썼던 이미지 파일). 이 PC 안에서만 처리되고 어디에도 업로드되지 않는다. */
  const pickBg = useCallback(
    (file: File | null) => {
      if (!file) {
        bgImg.current = null;
        setBgName("");
        rebuildBg(blur);
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        bgImg.current = img;
        setBgName(file.name);
        rebuildBg(blur);
      };
      img.onerror = () => setError("이미지를 읽지 못했습니다. jpg·png 파일을 선택해 주세요.");
      img.src = url;
    },
    [blur, rebuildBg],
  );

  useEffect(() => {
    if (!open || video) return;
    let raf = 0;
    const tick = (t: number) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) paint(ctx, liveRef.current, t, bgRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, video]);

  const wait = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      const t0 = performance.now();
      const id = setInterval(() => {
        if (cancelled.current) {
          clearInterval(id);
          reject(new Error("cancelled"));
        } else if (performance.now() - t0 >= ms) {
          clearInterval(id);
          resolve();
        }
      }, 16);
    });

  const setPhase = (phase: Phase) => {
    liveRef.current.phase = phase;
    liveRef.current.phaseAt = performance.now();
  };

  const stopRecorder = (): Promise<Blob | null> =>
    new Promise((resolve) => {
      const rec = recRef.current;
      recRef.current = null;
      if (!rec || rec.state === "inactive") return resolve(null);
      rec.onstop = () => resolve(new Blob(chunks.current, { type: rec.mimeType || "video/webm" }));
      rec.stop();
    });

  /** 영상 설정 창을 연다(배경 이미지 선택 → "영상 만들기 시작"). pool = 룰렛에 보여줄 참여자 아이디들(없으면 당첨자끼리). */
  const make = useCallback((opts: { title: string; winners: StageWinner[]; pool?: string[] }) => {
    if (!opts.winners.length) return;
    pending.current = opts;
    cancelled.current = false;
    setError("");
    setVideo(null);
    const L: Live = { phase: "intro", phaseAt: performance.now() - 5000, title: opts.title, label: "", name: "", index: 0, total: opts.winners.length, winners: [], particles: [] };
    liveRef.current = L;
    setSetup(true);
    setOpen(true);
  }, []);

  /** 설정을 마치고 실제 녹화 시작 */
  const begin = useCallback(
    async () => {
      const opts = pending.current;
      if (!opts) return;
      setSetup(false);
      cancelled.current = false;
      setError("");
      const L: Live = { phase: "intro", phaseAt: performance.now(), title: opts.title, label: "", name: "", index: 0, total: opts.winners.length, winners: [], particles: [] };
      for (let i = 0; i < 140; i++) L.particles.push({ x: Math.random() * W, y: -Math.random() * H, vx: (Math.random() - 0.5) * 3, vy: 3 + Math.random() * 6, r: 10 + Math.random() * 14, c: COLORS[i % COLORS.length], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3 });
      liveRef.current = L;
      const cv = canvasRef.current;
      if (!cv || !supported) {
        setError("이 브라우저는 영상 녹화를 지원하지 않습니다. Chrome에서 이용해 주세요.");
        return;
      }
      const names = [...new Set([...(opts.pool || []), ...opts.winners.map((w) => w.user)])];
      try {
        const stream = cv.captureStream(60);
        const types = ["video/mp4;codecs=avc1.640028", "video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
        const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
        const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 16_000_000 });
        chunks.current = [];
        rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
        recRef.current = rec;
        rec.start(250);
        setRecording(true);

        // 당첨자가 많을수록 빠르게 — 영상이 너무 길어지지 않게(5명 이하 느긋하게 / 15명 이하 보통 / 그 이상 빠르게)
        const n = opts.winners.length;
        const rollMs = n <= 5 ? 1500 : n <= 15 ? 900 : 500;
        const holdMs = n <= 5 ? 900 : n <= 15 ? 500 : 280;
        await wait(1800); // 인트로
        for (let i = 0; i < opts.winners.length; i++) {
          const w = opts.winners[i];
          L.index = i;
          L.label = w.label;
          setPhase("roll");
          // 점점 느려지는 룰렛: 45ms → 380ms 간격으로 이름을 바꾸다 멈춘다
          const total = rollMs;
          const t0 = performance.now();
          let last = "";
          let nextAt = 0;
          while (performance.now() - t0 < total) {
            const el = performance.now() - t0;
            if (el >= nextAt) {
              let n = names[Math.floor(Math.random() * names.length)];
              if (names.length > 1) while (n === last) n = names[Math.floor(Math.random() * names.length)];
              last = n;
              L.name = "@" + n;
              nextAt = el + 45 + Math.pow(el / total, 2.4) * 340;
            }
            await wait(16);
          }
          L.name = "@" + w.user;
          setPhase("reveal");
          await wait(holdMs);
          L.winners = [...L.winners, w];
        }
        setPhase("outro");
        await wait(4000);

        const blob = await stopRecorder();
        setRecording(false);
        if (blob) setVideo({ url: URL.createObjectURL(blob), ext: blob.type.includes("mp4") ? "mp4" : "webm" });
      } catch (e) {
        await stopRecorder();
        setRecording(false);
        if (!(e instanceof Error && e.message === "cancelled")) setError("영상 제작 중 오류: " + (e instanceof Error ? e.message : String(e)));
        else setOpen(false);
      }
    },
    [supported],
  );

  const close = useCallback(() => {
    if (setup) {
      setSetup(false);
      setOpen(false);
      return;
    }
    if (recording) {
      if (!confirm("영상 제작을 취소할까요?")) return;
      cancelled.current = true;
      return;
    }
    setOpen(false);
    setVideo((v) => {
      if (v) URL.revokeObjectURL(v.url);
      return null;
    });
  }, [recording, setup]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const modal = open ? (
    <div className="fixed inset-0 z-[60] bg-black/85 flex flex-col items-center justify-center gap-3 p-4" role="dialog" aria-modal="true" aria-label="당첨 발표 영상">
      {video ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={video.url} controls autoPlay loop className="rounded-xl bg-black" style={{ height: "78vh", aspectRatio: "9 / 16" }} />
      ) : (
        <canvas ref={canvasRef} width={W} height={H} className="rounded-xl bg-black" style={{ height: "78vh", aspectRatio: "9 / 16" }} />
      )}
      {setup && (
        <div className="flex items-center gap-3 flex-wrap justify-center text-[14px] bg-white/10 rounded-xl px-4 py-3 max-w-[560px]">
          <label className="px-3 py-2 rounded-lg bg-white text-gray-800 font-semibold cursor-pointer hover:bg-gray-100">
            🖼 배경 이미지 선택(피드 이미지)
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pickBg(e.target.files?.[0] ?? null)} />
          </label>
          {bgName ? (
            <>
              <span className="text-slate-200 max-w-[160px] truncate" title={bgName}>{bgName}</span>
              <button className="text-slate-300 underline" onClick={() => pickBg(null)}>제거</button>
              <label className="flex items-center gap-2 text-slate-200">
                흐림
                <input
                  type="range"
                  min={10}
                  max={70}
                  value={blur}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setBlur(v);
                    rebuildBg(v);
                  }}
                />
              </label>
            </>
          ) : (
            <span className="text-slate-300 text-[12px]">선택하지 않으면 기본 배경으로 만들어집니다.</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap justify-center text-[14px]">
        {setup && (
          <button className="px-5 py-2.5 rounded-lg bg-[#E5541B] text-white font-bold hover:bg-[#cc4915]" onClick={() => void begin()}>
            ▶ 영상 만들기 시작
          </button>
        )}
        {recording && (
          <span className="text-red-400 font-bold">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse mr-1.5" />
            영상 제작 중 — 끝날 때까지 이 창을 열어 두세요
          </span>
        )}
        {error && <span className="text-amber-300">{error}</span>}
        {video && (
          <a className="px-5 py-2.5 rounded-lg bg-[#E5541B] text-white font-bold hover:bg-[#cc4915]" href={video.url} download={`workup-당첨발표-${new Date().toISOString().slice(0, 10)}.${video.ext}`}>
            영상 저장 (.{video.ext})
          </a>
        )}
        {video?.ext === "webm" && <span className="text-slate-300 text-[12px]">인스타에 안 올라가면 mp4로 변환해 주세요.</span>}
        <button className="px-4 py-2.5 rounded-lg border border-slate-500 text-slate-200 font-semibold hover:bg-white/10" onClick={close}>
          {recording || setup ? "취소" : "닫기 ✕"}
        </button>
      </div>
    </div>
  ) : null;

  return { make, modal, supported, busy: recording };
}
