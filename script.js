(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = {
    speed: 64,
    throttle: 28,
    battery: 86,
    tempOffset: 0,
    distance: 0,
    elapsed: 0,
    running: true,
    autoTest: false,
    lastTick: performance.now(),
    lastUi: 0
  };

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const pad = (n, len = 2) => String(Math.floor(n)).padStart(len, "0");
  const formatClock = (seconds) => {
    const s = Math.floor(seconds);
    return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
  };
  const formatElapsed = (seconds) => `${pad(seconds / 60)}:${pad(seconds % 60)}`;

  // Build gauge ticks once, keeping the SVG crisp on retina displays.
  const ticks = $("speedTicks");
  const cx = 160, cy = 185;
  for (let i = 0; i <= 24; i++) {
    const angle = (135 + i * 11.25) * Math.PI / 180;
    const major = i % 2 === 0;
    const r1 = major ? 101 : 106;
    const r2 = 112;
    const x1 = cx + Math.cos(angle) * r1;
    const y1 = cy + Math.sin(angle) * r1;
    const x2 = cx + Math.cos(angle) * r2;
    const y2 = cy + Math.sin(angle) * r2;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1); line.setAttribute("y1", y1);
    line.setAttribute("x2", x2); line.setAttribute("y2", y2);
    line.setAttribute("class", `gauge-tick${major ? " major" : ""}`);
    ticks.appendChild(line);
    if (major) {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      const tx = cx + Math.cos(angle) * 87;
      const ty = cy + Math.sin(angle) * 87 + 3;
      text.setAttribute("x", tx); text.setAttribute("y", ty);
      text.setAttribute("class", "gauge-number");
      text.textContent = String(i * 10);
      ticks.appendChild(text);
    }
  }

  const rpmBar = $("rpmBar");
  for (let i = 0; i < 32; i++) {
    const segment = document.createElement("span");
    segment.className = "rpm-segment";
    rpmBar.appendChild(segment);
  }
  const rpmSegments = [...rpmBar.children];

  function derived() {
    const rpm = clamp(650 + state.speed * 26 + state.throttle * 19, 650, 8000);
    const load = clamp(Math.round(state.throttle * .72 + state.speed / 8), 0, 100);
    const engineTemp = clamp(72 + state.speed * .12 + state.throttle * .09 + state.tempOffset, 40, 130);
    const coolant = clamp(Math.round(engineTemp - 6), 35, 125);
    const torque = Math.round(55 + state.throttle * 3.2 + state.speed * .65);
    return { rpm, load, engineTemp, coolant, torque };
  }

  function setBar(id, value, max = 100) {
    $(id).style.width = `${clamp(value / max * 100, 0, 100)}%`;
  }

  function render() {
    const d = derived();
    $("speedValue").textContent = pad(state.speed, 3);
    $("speedSlider").value = state.speed;
    $("speedArc").style.strokeDashoffset = String(100 - state.speed / 240 * 100);
    $("speedState").textContent = state.speed === 0 ? "STATIONARY" : state.speed < 45 ? "LOW SPEED" : state.speed < 150 ? "CRUISING" : "HIGH SPEED";

    $("rpmValue").textContent = (d.rpm / 1000).toFixed(1);
    const lit = Math.round(d.rpm / 8000 * rpmSegments.length);
    rpmSegments.forEach((seg, i) => {
      const active = i < lit;
      const hot = i >= 24;
      seg.style.background = active ? (hot ? "var(--orange)" : i >= 19 ? "var(--blue)" : "var(--cyan)") : "#182b3f";
      seg.style.opacity = active ? "1" : ".7";
      seg.style.boxShadow = active ? `0 0 8px ${hot ? "rgba(255,180,94,.4)" : "rgba(85,242,239,.3)"}` : "none";
    });
    $("engineLoad").innerHTML = `${d.load}<span>%</span>`;
    setBar("loadBar", d.load);

    $("batteryValue").textContent = state.battery;
    $("batterySetting").textContent = `${state.battery}%`;
    $("batterySlider").value = state.battery;
    setBar("batteryBar", state.battery);
    $("batteryLevel").style.width = `${state.battery}%`;
    $("batteryLevel").style.background = state.battery < 20 ? "var(--orange)" : "var(--green)";
    $("batteryBar").style.background = state.battery < 20 ? "var(--orange)" : "";
    $("batteryState").textContent = state.battery < 20 ? "LOW CHARGE" : "NOMINAL";
    $("batteryState").className = `status-pill ${state.battery < 20 ? "warning" : "normal"}`;
    $("batteryVoltage").textContent = `${Math.round(330 + state.battery * .72)} V SIM`;

    const temp = Math.round(d.engineTemp);
    $("tempValue").textContent = temp;
    setBar("tempBar", temp - 40, 90);
    $("tempBar").style.width = `${clamp((temp - 40) / 90 * 100, 0, 100)}%`;
    const hot = temp >= 105;
    $("tempState").textContent = hot ? "CAUTION" : temp >= 95 ? "ELEVATED" : "NORMAL";
    $("tempState").className = `status-pill ${hot || temp >= 95 ? "warning" : "normal"}`;
    $("tempBar").style.background = hot ? "var(--orange)" : "linear-gradient(90deg,var(--green),var(--orange))";
    $("tempDot").style.background = hot ? "var(--orange)" : "var(--green)";
    $("tempMessage").textContent = hot ? "TEMPERATURE ABOVE NORMAL RANGE" : temp >= 95 ? "THERMAL LOAD ELEVATED" : "THERMAL RANGE STABLE";

    $("distanceValue").textContent = state.distance.toFixed(1);
    $("elapsedTime").textContent = formatElapsed(state.elapsed);
    $("runtimeValue").textContent = formatClock(state.elapsed);

    $("throttleValue").textContent = Math.round(state.throttle);
    $("throttleSetting").textContent = `${Math.round(state.throttle)}%`;
    $("throttleSlider").value = state.throttle;
    setBar("throttleBar", state.throttle);
    $("torqueValue").textContent = d.torque;
    setBar("torqueBar", d.torque, 400);
    $("coolantValue").textContent = d.coolant;
    setBar("coolantBar", d.coolant, 125);

    const caution = hot || state.battery < 10;
    $("systemState").textContent = !state.running ? "PAUSED" : caution ? "CAUTION" : state.speed === 0 ? "READY" : "ACTIVE";
    $("systemState").className = `system-state${!state.running ? " paused" : caution ? " caution" : ""}`;
    $("systemShort").textContent = !state.running ? "PAUSED" : caution ? "CAUTION" : state.speed === 0 ? "READY" : "ACTIVE";
    $("systemDot").style.background = !state.running ? "#7b9ab1" : caution ? "var(--orange)" : "var(--green)";
    $("systemDot").style.boxShadow = !state.running ? "none" : `0 0 8px ${caution ? "var(--orange)" : "var(--green)"}`;
    $("systemCaption").textContent = !state.running ? "SIMULATION PAUSED · VALUES HELD" : caution ? "VIRTUAL WARNING THRESHOLD REACHED" : "SIMULATION RUNNING · ALL VIRTUAL SYSTEMS NOMINAL";
    $("dataStream").textContent = state.running ? "LIVE" : "HOLD";
    $("runIcon").textContent = state.running ? "Ⅱ" : "▶";
    $("runLabel").textContent = state.running ? "PAUSE SIMULATION" : "RESUME SIMULATION";
  }

  $("speedSlider").addEventListener("input", e => { state.speed = Number(e.target.value); render(); });
  $("speedDown").addEventListener("click", () => { state.speed = clamp(state.speed - 5, 0, 240); render(); });
  $("speedUp").addEventListener("click", () => { state.speed = clamp(state.speed + 5, 0, 240); render(); });
  $("throttleSlider").addEventListener("input", e => { state.throttle = Number(e.target.value); render(); });
  $("tempSlider").addEventListener("input", e => {
    state.tempOffset = Number(e.target.value);
    $("tempSetting").textContent = `${state.tempOffset > 0 ? "+" : ""}${state.tempOffset}°C`;
    render();
  });
  $("batterySlider").addEventListener("input", e => { state.battery = Number(e.target.value); render(); });
  $("runToggle").addEventListener("click", () => {
    state.running = !state.running;
    state.lastTick = performance.now();
    render();
  });
  $("resetTrip").addEventListener("click", () => {
    state.distance = 0;
    state.elapsed = 0;
    render();
  });
  $("randomize").addEventListener("click", () => {
    state.autoTest = !state.autoTest;
    $("randomize").textContent = state.autoTest ? "■ STOP AUTO TEST" : "⟳ AUTO TEST";
    if (state.autoTest) {
      state.speed = Math.round(20 + Math.random() * 180);
      state.throttle = Math.round(15 + Math.random() * 80);
      state.tempOffset = Math.round(Math.random() * 25);
      $("tempSlider").value = state.tempOffset;
      $("tempSetting").textContent = `+${state.tempOffset}°C`;
    }
    render();
  });

  function tick(now) {
    const dt = Math.min((now - state.lastTick) / 1000, 0.25);
    state.lastTick = now;
    if (state.running) {
      state.elapsed += dt;
      state.distance += state.speed * dt / 3600;
      if (state.autoTest && now - state.lastUi > 2200) {
        state.lastUi = now;
        state.speed = clamp(state.speed + Math.round(Math.random() * 36 - 18), 0, 240);
        state.throttle = clamp(state.throttle + Math.round(Math.random() * 24 - 12), 0, 100);
        render();
      }
      // Battery drains slowly only while moving; deliberately exaggerated enough to demonstrate the display.
      if (state.speed > 0) state.battery = Math.max(0, Math.round((state.battery - dt * state.speed * 0.000018) * 1000) / 1000);
      if (Math.floor(state.elapsed * 4) !== Math.floor((state.elapsed - dt) * 4)) render();
    }
    requestAnimationFrame(tick);
  }

  function updateClock() {
    const now = new Date();
    const value = [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join(":");
    $("clock").textContent = value;
    $("footerClock").textContent = `LOCAL ${value}`;
  }
  updateClock();
  setInterval(updateClock, 1000);
  render();
  requestAnimationFrame(tick);
})();
