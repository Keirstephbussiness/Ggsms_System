// ══════════════════════════════════════════════════════════════
//  GGSMS — No Internet Detector  (self-contained, no deps)
//  Drop this <script> anywhere — it injects its own CSS + HTML
// ══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // ── 1. INJECT STYLES ─────────────────────────────────────
    const css = document.createElement('style');
    css.textContent = `

@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;800&family=Inter:wght@500;600;700&display=swap');

/* ════════════════════════════════════
   OVERLAY
════════════════════════════════════ */
.ni-overlay {
    position: fixed;
    inset: 0;
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(8, 28, 80, 0.82);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    opacity: 0;
    visibility: hidden;
    transition: opacity .5s ease, visibility .5s ease;
}
.ni-overlay.ni-show { opacity: 1; visibility: visible; }
.ni-overlay::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
        radial-gradient(ellipse 70% 50% at 20% 80%, rgba(0,71,171,.45) 0%, transparent 60%),
        radial-gradient(ellipse 50% 40% at 80% 20%, rgba(0,120,200,.3) 0%, transparent 60%);
    animation: ni-bg-drift 14s ease-in-out infinite alternate;
    pointer-events: none;
}
@keyframes ni-bg-drift {
    from { transform: scale(1); }
    to   { transform: scale(1.06) rotate(1deg); }
}

/* ════════════════════════════════════
   CARD
════════════════════════════════════ */
.ni-card {
    position: relative;
    background: #fff;
    border-radius: 28px;
    border: 2px solid rgba(212,175,55,.45);
    box-shadow:
        0 40px 100px rgba(8,28,80,.40),
        0 0 0 8px rgba(212,175,55,.06),
        inset 0 1px 0 rgba(255,255,255,.9);
    padding: 0 0 36px;
    text-align: center;
    max-width: 460px;
    width: 92%;
    overflow: hidden;
    transform: translateY(50px) scale(.9);
    opacity: 0;
    transition: transform .6s cubic-bezier(.34,1.4,.64,1), opacity .5s ease;
}
.ni-overlay.ni-show .ni-card { transform: translateY(0) scale(1); opacity: 1; }
.ni-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 5px;
    background: linear-gradient(90deg, #0A2463 0%, #3E7CB1 25%, #D4AF37 50%, #3E7CB1 75%, #0A2463 100%);
    background-size: 300% 100%;
    animation: ni-bar-run 3.5s linear infinite;
    z-index: 2;
}
@keyframes ni-bar-run {
    from { background-position: 0% 0%; }
    to   { background-position: 300% 0%; }
}

/* ════════════════════════════════════
   SCENE
════════════════════════════════════ */
.ni-scene {
    width: 100%;
    height: 240px;
    background: linear-gradient(180deg,
        #C9E8F5 0%,
        #8FC8E8 28%,
        #4A9FD4 55%,
        #1A6BAF 75%,
        #0D4A88 100%);
    position: relative;
    overflow: hidden;
}

/* ── Sun ── */
.ni-sun {
    position: absolute;
    top: 22px; right: 44px;
    width: 36px; height: 36px;
    border-radius: 50%;
    background: radial-gradient(circle, #FFFDE0 0%, #FFE033 45%, rgba(255,200,0,0) 100%);
    box-shadow: 0 0 28px 14px rgba(255,220,60,.32);
    animation: ni-sun-pulse 4s ease-in-out infinite;
}
@keyframes ni-sun-pulse {
    0%,100%{ box-shadow:0 0 28px 14px rgba(255,220,60,.32); }
    50%     { box-shadow:0 0 50px 24px rgba(255,220,60,.5); }
}

/* ── Clouds ── */
.ni-cloud {
    position: absolute;
    border-radius: 50px;
    background: rgba(255,255,255,.88);
    filter: blur(2px);
}
.ni-cloud::before, .ni-cloud::after {
    content: ''; position: absolute;
    background: rgba(255,255,255,.88); border-radius: 50%;
}
.ni-cloud-1 { width:96px; height:22px; top:18px; left:-110px; animation:ni-cloud-move 19s linear infinite; }
.ni-cloud-1::before { width:40px;height:40px;top:-20px;left:16px; }
.ni-cloud-1::after  { width:28px;height:28px;top:-14px;left:50px; }
.ni-cloud-2 { width:64px; height:16px; top:46px; left:-80px; animation:ni-cloud-move 27s linear infinite 7s; opacity:.7; }
.ni-cloud-2::before { width:28px;height:28px;top:-14px;left:10px; }
.ni-cloud-2::after  { width:20px;height:20px;top:-10px;left:34px; }
.ni-cloud-3 { width:120px; height:26px; top:8px; left:-135px; animation:ni-cloud-move 23s linear infinite 13s; opacity:.5; }
.ni-cloud-3::before { width:48px;height:48px;top:-24px;left:20px; }
.ni-cloud-3::after  { width:32px;height:32px;top:-16px;left:58px; }
@keyframes ni-cloud-move { from{transform:translateX(0)} to{transform:translateX(620px)} }

/* ── Rain ── */
.ni-rain { position:absolute; inset:0; pointer-events:none; }
.ni-rdrop {
    position:absolute; top:-30px; width:1.5px; border-radius:2px;
    background:linear-gradient(to bottom, rgba(120,180,255,0), rgba(180,220,255,.7));
    animation:ni-rain-fall linear infinite;
}
.ni-rdrop:nth-child(1){left:5%;  height:26px;animation-duration:1.1s;animation-delay:.0s}
.ni-rdrop:nth-child(2){left:14%; height:20px;animation-duration:.9s; animation-delay:.3s}
.ni-rdrop:nth-child(3){left:24%; height:30px;animation-duration:1.3s;animation-delay:.1s}
.ni-rdrop:nth-child(4){left:36%; height:18px;animation-duration:1.0s;animation-delay:.6s}
.ni-rdrop:nth-child(5){left:49%; height:24px;animation-duration:1.2s;animation-delay:.2s}
.ni-rdrop:nth-child(6){left:60%; height:16px;animation-duration:.85s;animation-delay:.45s}
.ni-rdrop:nth-child(7){left:71%; height:28px;animation-duration:1.15s;animation-delay:.15s}
.ni-rdrop:nth-child(8){left:82%; height:22px;animation-duration:1.05s;animation-delay:.5s}
.ni-rdrop:nth-child(9){left:91%; height:18px;animation-duration:.95s;animation-delay:.35s}
@keyframes ni-rain-fall {
    from{transform:translateY(-10px);opacity:.9}
    to  {transform:translateY(270px);opacity:0}
}

/* ── No-signal badge ── */
.ni-badge {
    position:absolute; top:14px; left:14px;
    background:rgba(255,255,255,.93);
    border:1.5px solid rgba(239,68,68,.4);
    border-radius:10px; padding:5px 9px;
    display:flex; align-items:center; gap:5px;
    animation:ni-badge-pulse 1.6s ease-in-out infinite;
    box-shadow:0 4px 12px rgba(239,68,68,.2); z-index:10;
}
@keyframes ni-badge-pulse {
    0%,100%{box-shadow:0 4px 12px rgba(239,68,68,.2);transform:scale(1)}
    50%     {box-shadow:0 4px 20px rgba(239,68,68,.4);transform:scale(1.04)}
}
.ni-badge-dot { width:8px;height:8px;border-radius:50%;background:#EF4444;animation:ni-dot-blink 1.2s ease-in-out infinite; }
@keyframes ni-dot-blink { 0%,100%{opacity:1} 50%{opacity:.2} }
.ni-badge-text { font-family:'Inter',sans-serif;font-size:10px;font-weight:700;color:#EF4444;letter-spacing:.4px;text-transform:uppercase; }

/* ── Ship bob animation ── */
.ni-ship-wrap {
    position: absolute;
    bottom: 48px;
    left: 50%;
    transform: translateX(-50%);
    transform-origin: center bottom;
    animation: ni-bob 4s ease-in-out infinite;
    filter: drop-shadow(0 10px 20px rgba(0,0,0,.4));
}
@keyframes ni-bob {
    0%,100%{ transform:translateX(-50%) translateY(0)    rotate(0deg); }
    25%     { transform:translateX(-50%) translateY(-8px)  rotate(-1.4deg); }
    75%     { transform:translateX(-50%) translateY(5px)   rotate(1.1deg); }
}

/* ── Smoke puffs ── */
.ni-smoke-wrap { position:absolute; pointer-events:none; }
.ni-puff {
    position:absolute; border-radius:50%;
    background:rgba(200,205,220,.65);
    filter:blur(3px);
    animation:ni-puff-rise linear infinite;
}
.ni-puff:nth-child(1){width:10px;height:10px;left:-5px; animation-duration:2.2s;animation-delay:0s}
.ni-puff:nth-child(2){width:16px;height:16px;left:-8px; animation-duration:2.6s;animation-delay:.8s}
.ni-puff:nth-child(3){width:22px;height:22px;left:-11px;animation-duration:3.0s;animation-delay:1.5s}
@keyframes ni-puff-rise {
    0%  {transform:translate(0,0) scale(1);     opacity:.8}
    100%{transform:translate(-24px,-65px) scale(2.4);opacity:0}
}

/* ── Wake ── */
.ni-wake {
    position:absolute; bottom:48px; left:50%;
    transform:translateX(-50%);
    display:flex; flex-direction:column; gap:4px;
    animation:ni-bob 4s ease-in-out infinite;
    opacity:.55; pointer-events:none;
}
.ni-wake-line {
    height:3px; border-radius:2px;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.9),transparent);
    animation:ni-wake-spread 2.3s ease-in-out infinite;
}
.ni-wake-line:nth-child(1){width:120px;animation-delay:0s}
.ni-wake-line:nth-child(2){width:78px; animation-delay:.3s}
.ni-wake-line:nth-child(3){width:46px; animation-delay:.6s}
@keyframes ni-wake-spread {
    0%,100%{opacity:.55;transform:scaleX(1)}
    50%     {opacity:1;  transform:scaleX(1.2)}
}

/* ── Ocean waves ── */
.ni-ocean-wrap { position:absolute; bottom:0; left:-10px; right:-10px; height:62px; }
.ni-wave-svg   { position:absolute; bottom:0; width:calc(100% + 20px); height:62px; }
.ni-wave-svg.wv1{animation:ni-wv1 2.8s ease-in-out infinite;      fill:rgba(8,36,99,.7)}
.ni-wave-svg.wv2{animation:ni-wv2 2.2s ease-in-out infinite .5s;  fill:rgba(12,50,130,.5)}
.ni-wave-svg.wv3{animation:ni-wv1 3.6s ease-in-out infinite 1.1s; fill:rgba(5,25,80,.35)}
@keyframes ni-wv1{0%,100%{transform:translateX(0) scaleY(1)} 50%{transform:translateX(-22px) scaleY(1.14)}}
@keyframes ni-wv2{0%,100%{transform:translateX(0) scaleY(1)} 50%{transform:translateX(18px)  scaleY(.87)}}

/* ════════════════════════════════════
   TEXT SECTION
════════════════════════════════════ */
.ni-body { padding: 28px 36px 0; }

.ni-title {
    font-family:'Poppins',sans-serif;
    font-size:22px; font-weight:800;
    color:#0A2463; margin:0 0 10px; letter-spacing:-.3px;
}
.ni-title span {
    background:linear-gradient(135deg,#0A2463 0%,#3E7CB1 50%,#D4AF37 100%);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
}
.ni-desc {
    font-family:'Inter',sans-serif;
    font-size:13.5px; font-weight:500;
    color:#6B7280; line-height:1.7; margin:0 0 24px;
}
.ni-desc strong { color:#0A2463; font-weight:700; }

.ni-btn {
    display:inline-flex; align-items:center; gap:9px;
    padding:13px 30px;
    background:linear-gradient(135deg,#B8942E,#D4AF37,#F1D16A);
    color:#fff; border:none; border-radius:14px;
    font-family:'Inter',sans-serif; font-size:14px; font-weight:800;
    cursor:pointer; letter-spacing:.3px;
    box-shadow:0 8px 24px rgba(212,175,55,.45),0 2px 0 rgba(255,255,255,.2) inset;
    transition:transform .25s ease, box-shadow .25s ease;
    position:relative; overflow:hidden;
}
.ni-btn::before {
    content:''; position:absolute; top:0; left:-80%; width:50%; height:100%;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);
    transform:skewX(-20deg);
}
.ni-btn:hover::before { animation:ni-sweep .55s ease forwards; }
@keyframes ni-sweep { to{left:140%} }
.ni-btn:hover { transform:translateY(-4px); box-shadow:0 14px 36px rgba(212,175,55,.55),0 2px 0 rgba(255,255,255,.25) inset; }
.ni-btn:active { transform:translateY(0); }
.ni-btn.ni-checking .ni-btn-icon { animation:ni-spin .65s linear infinite; }
@keyframes ni-spin { to{transform:rotate(360deg)} }

.ni-dots { display:flex;align-items:center;justify-content:center;gap:6px;margin-top:18px; }
.ni-dot { width:7px;height:7px;border-radius:50%;background:#D4AF37;animation:ni-dot-bounce 1.3s ease-in-out infinite; }
.ni-dot:nth-child(2){animation-delay:.2s}
.ni-dot:nth-child(3){animation-delay:.4s}
@keyframes ni-dot-bounce {
    0%,80%,100%{transform:translateY(0);opacity:.35}
    40%         {transform:translateY(-6px);opacity:1}
}
.ni-dots-label { font-family:'Inter',sans-serif;font-size:11px;font-weight:600;color:#9CA3AF;margin-left:6px; }

.ni-online-toast {
    position:fixed; bottom:28px; left:50%;
    transform:translateX(-50%) translateY(20px);
    background:linear-gradient(135deg,#047857,#059669);
    color:#fff; font-family:'Inter',sans-serif; font-size:13px; font-weight:700;
    padding:11px 24px; border-radius:12px;
    box-shadow:0 8px 28px rgba(16,185,129,.45);
    display:flex; align-items:center; gap:8px;
    opacity:0; visibility:hidden;
    transition:all .45s cubic-bezier(.34,1.4,.64,1);
    z-index:1000000; white-space:nowrap;
}
.ni-online-toast.ni-show { opacity:1;visibility:visible;transform:translateX(-50%) translateY(0); }
    `;
    document.head.appendChild(css);

    // ── 2. BUILD DOM ──────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.className = 'ni-overlay';
    overlay.setAttribute('role','alertdialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','No internet connection');
    overlay.innerHTML = `
<div class="ni-card">

  <div class="ni-scene">

    <div class="ni-sun"></div>
    <div class="ni-cloud ni-cloud-1"></div>
    <div class="ni-cloud ni-cloud-2"></div>
    <div class="ni-cloud ni-cloud-3"></div>

    <div class="ni-rain">
      <div class="ni-rdrop"></div><div class="ni-rdrop"></div>
      <div class="ni-rdrop"></div><div class="ni-rdrop"></div>
      <div class="ni-rdrop"></div><div class="ni-rdrop"></div>
      <div class="ni-rdrop"></div><div class="ni-rdrop"></div>
      <div class="ni-rdrop"></div>
    </div>

    <div class="ni-badge">
      <div class="ni-badge-dot"></div>
      <span class="ni-badge-text">No Signal</span>
    </div>

    <!-- Smoke above funnel -->
    <div class="ni-smoke-wrap" style="top:24px; left:calc(50% + 38px);">
      <div class="ni-puff"></div>
      <div class="ni-puff"></div>
      <div class="ni-puff"></div>
    </div>

    <!--
        SHIP SVG — viewBox 0 0 320 120
        Waterline is at y=80 inside the SVG.
        .ni-ship-wrap is bottom:48px so the ocean surface aligns with y=80.
        Ship has:
          - Long flat hull with pronounced freeboard above waterline
          - Raked pointed bow (right side)
          - Squared stern (left side)
          - Multi-deck superstructure center-aft
          - Tall cylindrical funnel with gold bands
          - Mast with yard and flag
          - Lifeboat on davits
          - Portholes and railings
    -->
    <div class="ni-ship-wrap">
      <svg width="320" height="120" viewBox="0 0 320 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ni-hullAbove" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2255B0"/>
            <stop offset="100%" stop-color="#0A2260"/>
          </linearGradient>
          <linearGradient id="ni-hullBelow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#081840"/>
            <stop offset="100%" stop-color="#5A1010"/>
          </linearGradient>
          <linearGradient id="ni-super" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4880D0"/>
            <stop offset="100%" stop-color="#2450A0"/>
          </linearGradient>
          <linearGradient id="ni-funnel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#1A3A90"/>
            <stop offset="60%" stop-color="#1E48AA"/>
            <stop offset="100%" stop-color="#0E2468"/>
          </linearGradient>
        </defs>

        <!-- ═══ SUBMERGED HULL ═══ -->
        <!-- Main body below waterline: gentle keel curve, wide amidships -->
        <path d="M 18 80 L 272 80 L 286 88 C 295 96 296 108 284 114 L 48 118 C 22 118 14 108 16 96 Z"
              fill="url(#ni-hullBelow)"/>
        <!-- Red anti-fouling bottom strip -->
        <path d="M 18 104 C 16 116 26 118 48 118 L 284 118 C 302 118 300 112 286 108 Z"
              fill="#7A1212" opacity=".85"/>

        <!-- ═══ HULL ABOVE WATERLINE (freeboard) ═══
             Long, flat-sided slab from deck (y=52) down to waterline (y=80).
             Key: bow on RIGHT side rakes sharply forward and upward.
             Stern on LEFT is squared / vertical.
        -->
        <!-- Main hull topsides -->
        <path d="M 18 52 L 18 80 L 272 80 L 282 66 L 280 52 Z"
              fill="url(#ni-hullAbove)"/>
        <!-- Starboard (right) BOW section — raked forward, flared -->
        <path d="M 280 52 L 292 42 C 302 34 310 44 308 60 C 306 72 298 80 286 82 L 272 80 L 282 66 Z"
              fill="#122870"/>
        <!-- Bow waterline highlight -->
        <path d="M 291 44 C 300 36 308 48 306 62" stroke="rgba(212,175,55,.5)" stroke-width="1.6" stroke-linecap="round" fill="none"/>
        <!-- Port (left) STERN — flat vertical transom -->
        <path d="M 18 52 L 10 56 C 7 62 7 74 12 80 L 18 80 Z"
              fill="#0E2060"/>
        <!-- Stern rubbing strake -->
        <line x1="10" y1="66" x2="12" y2="80" stroke="#D4AF37" stroke-width="1" opacity=".4" stroke-linecap="round"/>

        <!-- WATERLINE gold stripe -->
        <line x1="18" y1="80" x2="273" y2="80" stroke="#D4AF37" stroke-width="2.5" stroke-linecap="round"/>

        <!-- ═══ MAIN DECK ═══ -->
        <rect x="18" y="47" width="264" height="6" rx="2"
              fill="#183A8C" stroke="#2E62CC" stroke-width=".9"/>
        <line x1="18" y1="50" x2="282" y2="50" stroke="#D4AF37" stroke-width=".9" opacity=".4"/>

        <!-- ═══ FORE DECK DETAILS ═══ -->
        <!-- Hatch #1 -->
        <rect x="24" y="40" width="28" height="8" rx="2" fill="#152E80" stroke="#2A52B8" stroke-width=".8"/>
        <line x1="38" y1="40" x2="38" y2="48" stroke="#2A52B8" stroke-width=".6" opacity=".5"/>
        <!-- Hatch #2 -->
        <rect x="58" y="40" width="28" height="8" rx="2" fill="#152E80" stroke="#2A52B8" stroke-width=".8"/>
        <line x1="72" y1="40" x2="72" y2="48" stroke="#2A52B8" stroke-width=".6" opacity=".5"/>
        <!-- Fore mast -->
        <line x1="50" y1="47" x2="50" y2="18" stroke="#C4A020" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="40" y1="24" x2="60" y2="24" stroke="#C4A020" stroke-width="1" stroke-linecap="round"/>
        <!-- Fore mast shroud -->
        <line x1="40" y1="24" x2="46" y2="47" stroke="#A88010" stroke-width=".6" opacity=".45"/>
        <line x1="60" y1="24" x2="54" y2="47" stroke="#A88010" stroke-width=".6" opacity=".45"/>

        <!-- ═══ AFT DECK (stern area) ═══ -->
        <rect x="248" y="40" width="24" height="8" rx="2" fill="#152E80" stroke="#2A52B8" stroke-width=".8"/>

        <!-- ═══ SUPERSTRUCTURE ═══
             Lower accommodation block (taller, wider)
        -->
        <rect x="100" y="26" width="118" height="22" rx="3"
              fill="url(#ni-super)" stroke="#3A6AC0" stroke-width="1.2"/>
        <!-- Square portholes / windows on accommodation -->
        <rect x="106" y="31" width="9" height="9" rx="2" fill="#90D0F0" stroke="rgba(255,255,255,.4)" stroke-width=".7"/>
        <rect x="120" y="31" width="9" height="9" rx="2" fill="#90D0F0" stroke="rgba(255,255,255,.4)" stroke-width=".7"/>
        <rect x="134" y="31" width="9" height="9" rx="2" fill="#90D0F0" stroke="rgba(255,255,255,.4)" stroke-width=".7"/>
        <rect x="148" y="31" width="9" height="9" rx="2" fill="#90D0F0" stroke="rgba(255,255,255,.4)" stroke-width=".7"/>
        <rect x="162" y="31" width="9" height="9" rx="2" fill="#90D0F0" stroke="rgba(255,255,255,.4)" stroke-width=".7"/>
        <rect x="176" y="31" width="9" height="9" rx="2" fill="#90D0F0" stroke="rgba(255,255,255,.4)" stroke-width=".7"/>
        <rect x="190" y="31" width="9" height="9" rx="2" fill="#90D0F0" stroke="rgba(255,255,255,.4)" stroke-width=".7"/>
        <rect x="204" y="31" width="9" height="9" rx="2" fill="#90D0F0" stroke="rgba(255,255,255,.4)" stroke-width=".7"/>
        <!-- Window glints -->
        <rect x="107" y="32" width="4" height="3" rx="1" fill="rgba(255,255,255,.38)"/>
        <rect x="121" y="32" width="4" height="3" rx="1" fill="rgba(255,255,255,.32)"/>
        <rect x="135" y="32" width="4" height="3" rx="1" fill="rgba(255,255,255,.32)"/>
        <rect x="149" y="32" width="4" height="3" rx="1" fill="rgba(255,255,255,.32)"/>
        <rect x="163" y="32" width="4" height="3" rx="1" fill="rgba(255,255,255,.32)"/>
        <rect x="177" y="32" width="4" height="3" rx="1" fill="rgba(255,255,255,.32)"/>
        <rect x="191" y="32" width="4" height="3" rx="1" fill="rgba(255,255,255,.32)"/>
        <rect x="205" y="32" width="4" height="3" rx="1" fill="rgba(255,255,255,.32)"/>

        <!-- Bridge / wheelhouse — upper, narrower, centered -->
        <rect x="120" y="10" width="78" height="18" rx="3"
              fill="#3A6AC0" stroke="#5090E0" stroke-width="1.2"/>
        <!-- Panoramic bridge windows -->
        <rect x="124" y="14" width="70" height="10" rx="2"
              fill="#B0E0F8" stroke="rgba(255,255,255,.4)" stroke-width=".8"/>
        <!-- Dividers -->
        <line x1="148" y1="14" x2="148" y2="24" stroke="rgba(255,255,255,.3)" stroke-width=".8"/>
        <line x1="170" y1="14" x2="170" y2="24" stroke="rgba(255,255,255,.3)" stroke-width=".8"/>
        <!-- Glints -->
        <rect x="126" y="15" width="18" height="4" rx="1" fill="rgba(255,255,255,.28)"/>
        <rect x="150" y="15" width="18" height="4" rx="1" fill="rgba(255,255,255,.22)"/>
        <rect x="172" y="15" width="18" height="4" rx="1" fill="rgba(255,255,255,.22)"/>
        <!-- Bridge wings -->
        <rect x="110" y="14" width="12" height="7" rx="2" fill="#2A50A0" stroke="#4070C8" stroke-width="1"/>
        <rect x="196" y="14" width="12" height="7" rx="2" fill="#2A50A0" stroke="#4070C8" stroke-width="1"/>

        <!-- ═══ FUNNEL / CHIMNEY ═══
             Tall tapered cylinder — hallmark of a ship
             Located just aft of center, rising above bridge
        -->
        <!-- Funnel body (slightly tapered, taller) -->
        <path d="M 173 26  L 169 -4  L 183 -4  L 179 26 Z"
              fill="url(#ni-funnel)"/>
        <!-- Funnel shade (right face darker) -->
        <path d="M 179 26 L 183 -4 L 185 -4 L 181 26 Z"
              fill="rgba(0,0,0,.22)"/>
        <!-- Gold accent band — wide -->
        <rect x="168" y="18" width="13" height="6" rx="1.5" fill="#D4AF37"/>
        <!-- Second thin gold ring -->
        <rect x="169" y="8" width="12" height="2.5" rx="1" fill="#D4AF37" opacity=".6"/>
        <!-- Funnel top rim (elliptical cap) -->
        <ellipse cx="176" cy="-4" rx="8" ry="2.5" fill="#0A1C58" stroke="#2A44A8" stroke-width=".9"/>
        <!-- Funnel highlight sheen -->
        <line x1="171" y1="2" x2="170" y2="22" stroke="rgba(255,255,255,.1)" stroke-width="2" stroke-linecap="round"/>

        <!-- ═══ MAIN MAST ═══ -->
        <!-- Mast rises from bridge top -->
        <line x1="158" y1="10" x2="158" y2="-14"
              stroke="#D4AF37" stroke-width="2.2" stroke-linecap="round"/>
        <!-- Yard arm (cross piece) -->
        <line x1="140" y1="-8" x2="176" y2="-8"
              stroke="#D4AF37" stroke-width="1.4" stroke-linecap="round"/>
        <!-- Shroud lines -->
        <line x1="140" y1="-8" x2="148" y2="10" stroke="#B89020" stroke-width=".65" opacity=".5"/>
        <line x1="176" y1="-8" x2="168" y2="10" stroke="#B89020" stroke-width=".65" opacity=".5"/>
        <!-- Waving flag pennant -->
        <path d="M 158 -14 Q 170 -10 180 -14 Q 170 -18 158 -14" fill="#EF4444" opacity=".92"/>
        <!-- Small radar / aerial at mast top -->
        <circle cx="158" cy="-14" r="2" fill="#D4AF37"/>

        <!-- ═══ HULL PORTHOLES (between deck & waterline) ═══ -->
        <!-- Port stern -->
        <circle cx="30"  cy="65" r="4.5" fill="#87CEEB" stroke="rgba(255,255,255,.5)" stroke-width="1"/>
        <circle cx="28"  cy="63" r="1.4" fill="rgba(255,255,255,.55)"/>
        <!-- Starboard bow area -->
        <circle cx="240" cy="65" r="4.5" fill="#87CEEB" stroke="rgba(255,255,255,.5)" stroke-width="1"/>
        <circle cx="238" cy="63" r="1.4" fill="rgba(255,255,255,.55)"/>
        <circle cx="258" cy="65" r="4.5" fill="#87CEEB" stroke="rgba(255,255,255,.5)" stroke-width="1"/>
        <circle cx="256" cy="63" r="1.4" fill="rgba(255,255,255,.55)"/>

        <!-- ═══ LIFEBOAT (on davits, starboard side) ═══ -->
        <!-- Davit arms -->
        <line x1="228" y1="48" x2="228" y2="40" stroke="#2A52B8" stroke-width="1.2"/>
        <line x1="240" y1="48" x2="240" y2="40" stroke="#2A52B8" stroke-width="1.2"/>
        <!-- Lifeboat hull — classic pointed-end small boat shape -->
        <path d="M 224 40 Q 234 34 244 40 L 243 45 Q 234 48 225 45 Z"
              fill="#E8920A" stroke="#B86800" stroke-width="1"/>
        <!-- Lifeboat cover band -->
        <line x1="225" y1="40" x2="243" y2="40" stroke="rgba(255,255,255,.4)" stroke-width=".8"/>

        <!-- ═══ RAILINGS ═══ -->
        <!-- Fore railing (port of superstructure) -->
        <line x1="18"  y1="42" x2="98"  y2="42" stroke="#3A68C8" stroke-width=".9" opacity=".55"/>
        <line x1="26"  y1="42" x2="26"  y2="47" stroke="#3A68C8" stroke-width=".7" opacity=".45"/>
        <line x1="40"  y1="42" x2="40"  y2="47" stroke="#3A68C8" stroke-width=".7" opacity=".45"/>
        <line x1="54"  y1="42" x2="54"  y2="47" stroke="#3A68C8" stroke-width=".7" opacity=".45"/>
        <line x1="68"  y1="42" x2="68"  y2="47" stroke="#3A68C8" stroke-width=".7" opacity=".45"/>
        <line x1="82"  y1="42" x2="82"  y2="47" stroke="#3A68C8" stroke-width=".7" opacity=".45"/>
        <!-- Aft railing (starboard of superstructure) -->
        <line x1="220" y1="42" x2="280" y2="42" stroke="#3A68C8" stroke-width=".9" opacity=".55"/>
        <line x1="222" y1="42" x2="222" y2="47" stroke="#3A68C8" stroke-width=".7" opacity=".45"/>
        <line x1="236" y1="42" x2="236" y2="47" stroke="#3A68C8" stroke-width=".7" opacity=".45"/>
        <line x1="250" y1="42" x2="250" y2="47" stroke="#3A68C8" stroke-width=".7" opacity=".45"/>
        <line x1="264" y1="42" x2="264" y2="47" stroke="#3A68C8" stroke-width=".7" opacity=".45"/>
        <line x1="278" y1="42" x2="278" y2="47" stroke="#3A68C8" stroke-width=".7" opacity=".45"/>

        <!-- ═══ ANCHOR (on bow) ═══ -->
        <g transform="translate(300,62)" opacity=".72">
          <circle r="5" stroke="#D4AF37" stroke-width="1.4" fill="none"/>
          <line y1="5" y2="13" stroke="#D4AF37" stroke-width="1.4" stroke-linecap="round"/>
          <line x1="-5" y1="13" x2="5" y2="13" stroke="#D4AF37" stroke-width="1.4" stroke-linecap="round"/>
          <line x1="-5" y1="10" x2="-5" y2="13" stroke="#D4AF37" stroke-width="1.4" stroke-linecap="round"/>
          <line x1="5"  y1="10" x2="5"  y2="13" stroke="#D4AF37" stroke-width="1.4" stroke-linecap="round"/>
        </g>

      </svg>
    </div>

    <!-- Wake lines -->
    <div class="ni-wake">
      <div class="ni-wake-line"></div>
      <div class="ni-wake-line"></div>
      <div class="ni-wake-line"></div>
    </div>

    <!-- Ocean waves -->
    <div class="ni-ocean-wrap">
      <svg class="ni-wave-svg wv3" viewBox="0 0 480 62" preserveAspectRatio="none">
        <path d="M0 40 Q60 24 120 40 Q180 56 240 40 Q300 24 360 40 Q420 56 480 40 L480 62 L0 62 Z"/>
      </svg>
      <svg class="ni-wave-svg wv1" viewBox="0 0 480 62" preserveAspectRatio="none">
        <path d="M0 32 Q60 14 120 32 Q180 50 240 32 Q300 14 360 32 Q420 50 480 32 L480 62 L0 62 Z"/>
      </svg>
      <svg class="ni-wave-svg wv2" viewBox="0 0 480 62" preserveAspectRatio="none">
        <path d="M0 38 Q60 20 120 38 Q180 56 240 38 Q300 20 360 38 Q420 56 480 38 L480 62 L0 62 Z"/>
      </svg>
    </div>

  </div><!-- /scene -->

  <!-- Text + controls -->
  <div class="ni-body">
    <h2 class="ni-title">&#9875; <span>Lost at Sea</span></h2>
    <p class="ni-desc">
      GGSMS cannot reach the server.<br>
      Please check your <strong>internet connection</strong> and try again.
    </p>

    <button class="ni-btn" id="niRetryBtn" type="button">
      <svg class="ni-btn-icon" width="16" height="16" viewBox="0 0 20 20" fill="none">
        <path d="M4 10a6 6 0 0 1 6-6 6 6 0 0 1 4.24 1.76L16 8"
              stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M16 10a6 6 0 0 1-6 6 6 6 0 0 1-4.24-1.76L4 12"
              stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        <polyline points="14 8 16 8 16 6" stroke="currentColor" stroke-width="2.2"
                  stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="6 12 4 12 4 14" stroke="currentColor" stroke-width="2.2"
                  stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Retry Connection
    </button>

    <div class="ni-dots">
      <div class="ni-dot"></div>
      <div class="ni-dot"></div>
      <div class="ni-dot"></div>
      <span class="ni-dots-label">Scanning for signal&hellip;</span>
    </div>
  </div>

</div><!-- /card -->
    `;
    document.body.appendChild(overlay);

    // ── Back-online toast ─────────────────────────────────────
    const toast = document.createElement('div');
    toast.className = 'ni-online-toast';
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <path d="M4 10 L8 14 L16 6" stroke="white" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Back online &mdash; GGSMS reconnected!
    `;
    document.body.appendChild(toast);

    // ── 3. LOGIC ──────────────────────────────────────────────
    const retryBtn = document.getElementById('niRetryBtn');
    let wasOffline = false;

    function showModal() { overlay.classList.add('ni-show'); wasOffline = true; }
    function hideModal() {
        overlay.classList.remove('ni-show');
        if (wasOffline) { showToast(); wasOffline = false; }
    }
    function showToast() {
        toast.classList.add('ni-show');
        setTimeout(() => toast.classList.remove('ni-show'), 3200);
    }
    function check() { navigator.onLine ? hideModal() : showModal(); }

    retryBtn.addEventListener('click', () => {
        retryBtn.classList.add('ni-checking');
        setTimeout(() => { retryBtn.classList.remove('ni-checking'); check(); }, 1600);
    });

    window.addEventListener('offline', showModal);
    window.addEventListener('online',  hideModal);
    check();
    setInterval(check, 6000);

})();