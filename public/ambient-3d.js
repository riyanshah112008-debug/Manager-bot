(() => {
  "use strict";
  const canvas = document.getElementById("starry-ambient");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const smallScreen = window.matchMedia("(max-width: 700px)").matches;
  let width = 0, height = 0, dpr = 1, frame = 0, lastDraw = 0;
  let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;
  const stars = [];
  const rings = 13;
  const segments = 30;
  const dots = [];
  const rand = (min, max) => min + Math.random() * (max - min);

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, smallScreen ? 1.15 : 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars.length = 0;
    const count = smallScreen ? 34 : 72;
    for (let i = 0; i < count; i++) stars.push({
      x: rand(0, width), y: rand(0, height), z: rand(.25, 1),
      r: rand(.35, 1.45), phase: rand(0, Math.PI * 2)
    });
  }

  function spherePoint(lat, lon, rotation) {
    const a = lon + rotation;
    const x = Math.cos(lat) * Math.cos(a);
    const y = Math.sin(lat);
    const z = Math.cos(lat) * Math.sin(a);
    const tilt = -.28;
    return {
      x: x * Math.cos(tilt) - y * Math.sin(tilt),
      y: x * Math.sin(tilt) + y * Math.cos(tilt),
      z
    };
  }

  function draw(now) {
    if (!reduceMotion && now - lastDraw < 32) { frame = requestAnimationFrame(draw); return; }
    lastDraw = now;
    ctx.clearRect(0, 0, width, height);
    const t = reduceMotion ? .35 : now * .00012;
    pointerX += (targetX - pointerX) * .035;
    pointerY += (targetY - pointerY) * .035;

    const cx = width * (smallScreen ? .78 : .79) + pointerX * 22;
    const cy = height * (smallScreen ? .22 : .30) + pointerY * 16;
    const radius = Math.min(width, height) * (smallScreen ? .205 : .235);
    const rotation = t * .72;

    const glow = ctx.createRadialGradient(cx, cy, radius * .05, cx, cy, radius * 1.45);
    glow.addColorStop(0, "rgba(105,119,255,.12)");
    glow.addColorStop(.58, "rgba(105,119,255,.035)");
    glow.addColorStop(1, "rgba(105,119,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, radius * 1.45, 0, Math.PI * 2); ctx.fill();

    // A perspective-projected wireframe sphere with front/back depth shading.
    for (let r = 1; r < rings; r++) {
      const lat = -Math.PI / 2 + Math.PI * r / rings;
      ctx.beginPath();
      for (let j = 0; j <= segments; j++) {
        const p = spherePoint(lat, (Math.PI * 2 * j) / segments, rotation);
        const perspective = 1 / (1.65 - p.z * .42);
        const x = cx + p.x * radius * perspective;
        const y = cy + p.y * radius * perspective;
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(144,157,255," + (0.055 + r / rings * .055) + ")";
      ctx.lineWidth = .65;
      ctx.stroke();
    }
    for (let j = 0; j < segments; j += 2) {
      ctx.beginPath();
      for (let r = 0; r <= rings; r++) {
        const lat = -Math.PI / 2 + Math.PI * r / rings;
        const p = spherePoint(lat, (Math.PI * 2 * j) / segments, rotation);
        const perspective = 1 / (1.65 - p.z * .42);
        const x = cx + p.x * radius * perspective;
        const y = cy + p.y * radius * perspective;
        if (r === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(160,145,255,.105)";
      ctx.lineWidth = .65;
      ctx.stroke();
    }

    // Floating orbital ellipses add a restrained 3D instrument-panel feel.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-.32 + Math.sin(t * .55) * .035);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.27, radius * .39, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(140,151,255,.19)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.rotate(1.12);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.18, radius * .32, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(182,128,255,.13)";
    ctx.stroke();
    ctx.restore();

    // Dust motes drift slowly across the full viewport.
    for (const star of stars) {
      const drift = reduceMotion ? 0 : t * (8 + star.z * 12);
      const x = (star.x + drift * star.z) % width;
      const y = star.y + Math.sin(t * 1.4 + star.phase) * 4 * star.z;
      const alpha = .16 + (Math.sin(t * 2 + star.phase) + 1) * .14;
      ctx.beginPath();
      ctx.arc(x, y, star.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(190,199,255," + alpha + ")";
      ctx.fill();
    }
    if (!reduceMotion) frame = requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", (event) => {
    targetX = (event.clientX / Math.max(width, 1) - .5) * 2;
    targetY = (event.clientY / Math.max(height, 1) - .5) * 2;
  }, { passive: true });
  resize();
  draw(0);
  if (reduceMotion) cancelAnimationFrame(frame);
})();
