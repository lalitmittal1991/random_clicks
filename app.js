(() => {
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
  const CONFUSION = ["b", "d", "p", "q", "6", "9", "m", "n"].map((v) => v.toUpperCase());
  const BALLOON_COLORS = ["#ff5f6d", "#f9a826", "#1e90ff", "#22b573", "#b565f7", "#00a8a8"];

  const DEFAULT_SETTINGS = {
    mode: "letters",
    fallRate: 120,
    spawnInterval: 1100,
    balloonsPerRound: 30,
    maxSimultaneous: 6,
    roundType: "count",
    roundSeconds: 60,
    wrongBehavior: "retry",
    enableClick: true,
    enableVoice: true,
    enablePopSound: true,
    voiceRate: 1,
    voicePitch: 1.2,
    voiceVolume: 1,
    theme: "classic",
    reducedMotion: false,
    difficulty: "custom",
    parentPin: "",
    pinLockEnabled: false,
  };

  const state = {
    settings: loadSettings(),
    running: false,
    paused: false,
    round: 1,
    score: 0,
    stars: 0,
    timer: 0,
    lastTs: 0,
    spawnTimer: 0,
    balloonsSpawned: 0,
    balloons: [],
    nextBalloonId: 1,
    stats: loadStats(),
    totalAttemptsThisRound: 0,
    totalHitsThisRound: 0,
    settingsUnlocked: false,
  };

  const el = {
    gameArea: $("gameArea"),
    startBtn: $("startBtn"),
    pauseBtn: $("pauseBtn"),
    resetBtn: $("resetBtn"),
    settingsBtn: $("settingsBtn"),
    closeSettingsBtn: $("closeSettingsBtn"),
    settingsPanel: $("settingsPanel"),
    settingsForm: $("settingsForm"),
    modeTag: $("modeTag"),
    messageText: $("messageText"),
    timerText: $("timerText"),
    scoreText: $("scoreText"),
    roundText: $("roundText"),
    starsText: $("starsText"),
    saveSettingsBtn: $("saveSettingsBtn"),
    testVoiceBtn: $("testVoiceBtn"),
    difficultySelect: $("difficultySelect"),
    lockSection: $("lockSection"),
    pinInput: $("pinInput"),
    unlockBtn: $("unlockBtn"),
    pinError: $("pinError"),
    savePinBtn: $("savePinBtn"),
    parentPin: $("parentPin"),
    accuracyText: $("accuracyText"),
    playTimeText: $("playTimeText"),
    mostMissedText: $("mostMissedText"),
  };

  const settingsRefs = {
    mode: $("modeSelect"),
    fallRate: $("fallRate"),
    spawnInterval: $("spawnInterval"),
    balloonsPerRound: $("balloonsPerRound"),
    maxSimultaneous: $("maxSimultaneous"),
    roundType: $("roundType"),
    roundSeconds: $("roundSeconds"),
    wrongBehavior: $("wrongBehavior"),
    enableClick: $("enableClick"),
    enableVoice: $("enableVoice"),
    enablePopSound: $("enablePopSound"),
    voiceRate: $("voiceRate"),
    voicePitch: $("voicePitch"),
    voiceVolume: $("voiceVolume"),
    theme: $("themeSelect"),
    reducedMotion: $("reducedMotion"),
    difficulty: $("difficultySelect"),
    fallRateValue: $("fallRateValue"),
    spawnIntervalValue: $("spawnIntervalValue"),
    voiceRateValue: $("voiceRateValue"),
    voicePitchValue: $("voicePitchValue"),
    voiceVolumeValue: $("voiceVolumeValue"),
  };

  wireEvents();
  hydrateSettingsForm();
  updateHud();
  updateStatsPanel();
  applyTheme();

  function wireEvents() {
    el.startBtn.addEventListener("click", startGame);
    el.pauseBtn.addEventListener("click", togglePause);
    el.resetBtn.addEventListener("click", resetGame);

    el.settingsBtn.addEventListener("click", openSettings);
    el.closeSettingsBtn.addEventListener("click", closeSettings);
    el.saveSettingsBtn.addEventListener("click", saveSettingsFromForm);
    el.testVoiceBtn.addEventListener("click", () => speak("A"));
    el.unlockBtn.addEventListener("click", tryUnlockSettings);
    el.savePinBtn.addEventListener("click", saveParentPin);

    settingsRefs.difficulty.addEventListener("change", applyDifficultyPreset);

    [
      settingsRefs.fallRate,
      settingsRefs.spawnInterval,
      settingsRefs.voiceRate,
      settingsRefs.voicePitch,
      settingsRefs.voiceVolume,
    ].forEach((slider) => {
      slider.addEventListener("input", syncSliderLabels);
    });

    el.gameArea.addEventListener("click", (ev) => {
      if (!state.settings.enableClick || !state.running || state.paused) {
        return;
      }
      const target = ev.target.closest(".balloon");
      if (!target) {
        return;
      }
      const id = Number(target.dataset.id);
      const balloon = state.balloons.find((b) => b.id === id);
      if (balloon) {
        popBalloon(balloon, "click");
      }
    });

    document.addEventListener("keydown", onKeydown);
  }

  function onKeydown(event) {
    if (!state.running || state.paused) {
      return;
    }

    const normalized = normalizeKey(event.key);
    if (!normalized) {
      return;
    }

    state.totalAttemptsThisRound += 1;
    let matched = false;

    // Match nearest balloon to bottom first to reduce frustration.
    const sorted = [...state.balloons].sort((a, b) => b.y - a.y);
    for (const balloon of sorted) {
      if (balloon.value === normalized) {
        matched = true;
        popBalloon(balloon, "keyboard");
        break;
      }
    }

    if (!matched) {
      showMessage("Try again, you can still pop it before it reaches bottom.");
      markWrongBalloon();
      if (state.settings.wrongBehavior === "drop") {
        const lead = sorted[0];
        if (lead) {
          missBalloon(lead, true);
        }
      }
    }
    updateStatsPanel();
  }

  function startGame() {
    if (state.running) {
      return;
    }
    state.running = true;
    state.paused = false;
    state.timer = 0;
    state.spawnTimer = 0;
    state.lastTs = 0;
    state.balloonsSpawned = 0;
    state.totalAttemptsThisRound = 0;
    state.totalHitsThisRound = 0;
    clearBalloons();

    el.startBtn.disabled = true;
    el.pauseBtn.disabled = false;

    el.gameArea.focus();
    showMessage("Type the matching key to pop balloons.");
    requestAnimationFrame(gameLoop);
  }

  function togglePause() {
    if (!state.running) {
      return;
    }
    state.paused = !state.paused;
    el.pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    showMessage(state.paused ? "Paused" : "Resumed");
    if (!state.paused) {
      requestAnimationFrame(gameLoop);
    }
  }

  function resetGame() {
    state.running = false;
    state.paused = false;
    state.timer = 0;
    state.spawnTimer = 0;
    state.balloonsSpawned = 0;
    state.balloons = [];

    el.startBtn.disabled = false;
    el.pauseBtn.disabled = true;
    el.pauseBtn.textContent = "Pause";

    clearBalloons();
    updateHud();
    showMessage("Game reset.");
  }

  function gameLoop(ts) {
    if (!state.running || state.paused) {
      return;
    }

    if (!state.lastTs) {
      state.lastTs = ts;
    }
    const dt = (ts - state.lastTs) / 1000;
    state.lastTs = ts;

    state.timer += dt;
    state.stats.playTimeSeconds += dt;
    state.spawnTimer += dt * 1000;

    maybeSpawnBalloon();
    moveBalloons(dt);
    updateHud();

    if (isRoundOver()) {
      endRound();
      return;
    }

    requestAnimationFrame(gameLoop);
  }

  function maybeSpawnBalloon() {
    if (state.balloons.length >= state.settings.maxSimultaneous) {
      return;
    }

    if (state.settings.roundType === "count" && state.balloonsSpawned >= state.settings.balloonsPerRound) {
      return;
    }

    while (state.spawnTimer >= state.settings.spawnInterval) {
      state.spawnTimer -= state.settings.spawnInterval;
      spawnBalloon();
      if (state.balloons.length >= state.settings.maxSimultaneous) {
        break;
      }
      if (state.settings.roundType === "count" && state.balloonsSpawned >= state.settings.balloonsPerRound) {
        break;
      }
    }
  }

  function spawnBalloon() {
    const value = randomFrom(getPoolForMode(state.settings.mode));
    const areaWidth = el.gameArea.clientWidth;
    const x = Math.max(8, Math.floor(Math.random() * (areaWidth - 84)));
    const balloon = {
      id: state.nextBalloonId++,
      value,
      x,
      y: -100,
      speed: state.settings.reducedMotion ? state.settings.fallRate * 0.7 : state.settings.fallRate,
      element: null,
    };

    const node = document.createElement("button");
    node.type = "button";
    node.className = "balloon";
    node.dataset.id = String(balloon.id);
    node.textContent = value;
    node.style.left = `${x}px`;
    node.style.top = `${balloon.y}px`;
    node.style.background = randomFrom(BALLOON_COLORS);

    balloon.element = node;
    state.balloons.push(balloon);
    el.gameArea.appendChild(node);
    state.balloonsSpawned += 1;
  }

  function moveBalloons(dt) {
    const areaHeight = el.gameArea.clientHeight;
    const toMiss = [];

    for (const balloon of state.balloons) {
      balloon.y += balloon.speed * dt;
      balloon.element.style.top = `${balloon.y}px`;
      if (balloon.y > areaHeight - 28) {
        toMiss.push(balloon);
      }
    }

    for (const balloon of toMiss) {
      missBalloon(balloon, false);
    }
  }

  function popBalloon(balloon, via) {
    state.score += 10;
    state.totalHitsThisRound += 1;
    state.stats.totalPopped += 1;
    removeBalloon(balloon, true);

    if (state.settings.enablePopSound) {
      playPopSound();
    }
    if (state.settings.enableVoice) {
      speak(balloon.value);
    }

    if (via === "keyboard") {
      showMessage(`Great! You popped ${balloon.value}.`);
    }
    updateHud();
  }

  function missBalloon(balloon, fromWrongKey) {
    state.stats.totalMissed += 1;
    state.stats.missedBySymbol[balloon.value] = (state.stats.missedBySymbol[balloon.value] || 0) + 1;
    removeBalloon(balloon, false);

    if (fromWrongKey) {
      showMessage("Incorrect key. That balloon is gone.");
    } else {
      showMessage(`Missed ${balloon.value}.`);
    }
    updateHud();
  }

  function removeBalloon(balloon, popped) {
    const idx = state.balloons.findIndex((b) => b.id === balloon.id);
    if (idx >= 0) {
      state.balloons.splice(idx, 1);
    }

    if (!balloon.element) {
      return;
    }

    if (popped) {
      balloon.element.classList.add("pop");
      setTimeout(() => balloon.element && balloon.element.remove(), 140);
    } else {
      balloon.element.remove();
    }
  }

  function isRoundOver() {
    if (state.settings.roundType === "time") {
      return state.timer >= state.settings.roundSeconds;
    }
    return state.balloonsSpawned >= state.settings.balloonsPerRound && state.balloons.length === 0;
  }

  function endRound() {
    state.running = false;
    state.paused = false;
    el.startBtn.disabled = false;
    el.pauseBtn.disabled = true;
    el.pauseBtn.textContent = "Pause";

    const acc = roundAccuracy();
    if (acc >= 90) {
      state.stars += 3;
    } else if (acc >= 75) {
      state.stars += 2;
    } else if (acc >= 50) {
      state.stars += 1;
    }

    state.round += 1;
    persistStats();
    updateHud();
    updateStatsPanel();
    showMessage(`Round complete. Accuracy ${acc.toFixed(0)}%.`);
  }

  function roundAccuracy() {
    if (state.totalAttemptsThisRound === 0) {
      return 0;
    }
    return (state.totalHitsThisRound / state.totalAttemptsThisRound) * 100;
  }

  function clearBalloons() {
    state.balloons = [];
    el.gameArea.querySelectorAll(".balloon").forEach((n) => n.remove());
  }

  function markWrongBalloon() {
    const nearest = [...state.balloons].sort((a, b) => b.y - a.y)[0];
    if (!nearest || !nearest.element) {
      return;
    }
    nearest.element.classList.remove("wrong");
    void nearest.element.offsetWidth;
    nearest.element.classList.add("wrong");
  }

  function updateHud() {
    el.scoreText.textContent = `Score: ${state.score}`;
    el.roundText.textContent = `Round: ${state.round}`;
    el.starsText.textContent = `Stars: ${state.stars}`;
    el.timerText.textContent = `Time: ${Math.floor(state.timer)}s`;
    el.modeTag.textContent = `Mode: ${modeLabel(state.settings.mode)}`;
  }

  function updateStatsPanel() {
    const total = state.stats.totalPopped + state.stats.totalMissed;
    const accuracy = total === 0 ? 0 : (state.stats.totalPopped / total) * 100;

    el.accuracyText.textContent = `Accuracy: ${accuracy.toFixed(1)}%`;
    el.playTimeText.textContent = `Play Time: ${Math.floor(state.stats.playTimeSeconds)}s`;
    el.mostMissedText.textContent = `Most Missed: ${getMostMissed() || "None"}`;
  }

  function openSettings() {
    const requiresPin = state.settings.pinLockEnabled && Boolean(state.settings.parentPin);

    state.settingsUnlocked = !requiresPin;
    el.settingsPanel.classList.remove("hidden");
    el.settingsPanel.setAttribute("aria-hidden", "false");

    if (requiresPin) {
      el.lockSection.classList.remove("hidden");
      el.settingsForm.classList.add("hidden");
      el.pinError.textContent = "";
      el.pinInput.value = "";
      el.pinInput.focus();
    } else {
      el.lockSection.classList.add("hidden");
      el.settingsForm.classList.remove("hidden");
    }
  }

  function closeSettings() {
    el.settingsPanel.classList.add("hidden");
    el.settingsPanel.setAttribute("aria-hidden", "true");
    el.lockSection.classList.add("hidden");
    el.settingsForm.classList.remove("hidden");
    state.settingsUnlocked = false;
  }

  function tryUnlockSettings() {
    if (el.pinInput.value === state.settings.parentPin) {
      el.lockSection.classList.add("hidden");
      el.settingsForm.classList.remove("hidden");
      state.settingsUnlocked = true;
      el.pinError.textContent = "";
    } else {
      el.pinError.textContent = "Incorrect PIN";
    }
  }

  function saveParentPin() {
    if (!state.settingsUnlocked && state.settings.pinLockEnabled) {
      showMessage("Unlock settings first.");
      return;
    }
    const value = el.parentPin.value.trim();
    if (value.length > 0 && !/^\d{4,6}$/.test(value)) {
      showMessage("PIN must be 4-6 digits.");
      return;
    }
    state.settings.parentPin = value;
    state.settings.pinLockEnabled = value.length > 0;
    persistSettings();
    showMessage(value ? "PIN saved." : "PIN removed.");
  }

  function hydrateSettingsForm() {
    settingsRefs.mode.value = state.settings.mode;
    settingsRefs.fallRate.value = String(state.settings.fallRate);
    settingsRefs.spawnInterval.value = String(state.settings.spawnInterval);
    settingsRefs.balloonsPerRound.value = String(state.settings.balloonsPerRound);
    settingsRefs.maxSimultaneous.value = String(state.settings.maxSimultaneous);
    settingsRefs.roundType.value = state.settings.roundType;
    settingsRefs.roundSeconds.value = String(state.settings.roundSeconds);
    settingsRefs.wrongBehavior.value = state.settings.wrongBehavior;
    settingsRefs.enableClick.checked = state.settings.enableClick;
    settingsRefs.enableVoice.checked = state.settings.enableVoice;
    settingsRefs.enablePopSound.checked = state.settings.enablePopSound;
    settingsRefs.voiceRate.value = String(state.settings.voiceRate);
    settingsRefs.voicePitch.value = String(state.settings.voicePitch);
    settingsRefs.voiceVolume.value = String(state.settings.voiceVolume);
    settingsRefs.theme.value = state.settings.theme;
    settingsRefs.reducedMotion.checked = state.settings.reducedMotion;
    settingsRefs.difficulty.value = state.settings.difficulty;
    el.parentPin.value = state.settings.parentPin;
    syncSliderLabels();
  }

  function saveSettingsFromForm() {
    if (!state.settingsUnlocked && state.settings.pinLockEnabled) {
      showMessage("Settings are locked. Enter PIN first.");
      return;
    }

    state.settings.mode = settingsRefs.mode.value;
    state.settings.fallRate = Number(settingsRefs.fallRate.value);
    state.settings.spawnInterval = Number(settingsRefs.spawnInterval.value);
    state.settings.balloonsPerRound = Number(settingsRefs.balloonsPerRound.value);
    state.settings.maxSimultaneous = Number(settingsRefs.maxSimultaneous.value);
    state.settings.roundType = settingsRefs.roundType.value;
    state.settings.roundSeconds = Number(settingsRefs.roundSeconds.value);
    state.settings.wrongBehavior = settingsRefs.wrongBehavior.value;
    state.settings.enableClick = settingsRefs.enableClick.checked;
    state.settings.enableVoice = settingsRefs.enableVoice.checked;
    state.settings.enablePopSound = settingsRefs.enablePopSound.checked;
    state.settings.voiceRate = Number(settingsRefs.voiceRate.value);
    state.settings.voicePitch = Number(settingsRefs.voicePitch.value);
    state.settings.voiceVolume = Number(settingsRefs.voiceVolume.value);
    state.settings.theme = settingsRefs.theme.value;
    state.settings.reducedMotion = settingsRefs.reducedMotion.checked;
    state.settings.difficulty = settingsRefs.difficulty.value;

    persistSettings();
    applyTheme();
    syncSliderLabels();
    updateHud();
    showMessage("Settings saved.");
  }

  function applyDifficultyPreset() {
    const val = settingsRefs.difficulty.value;
    if (val === "custom") {
      return;
    }

    if (val === "easy") {
      settingsRefs.fallRate.value = "80";
      settingsRefs.spawnInterval.value = "1400";
      settingsRefs.maxSimultaneous.value = "4";
    } else if (val === "medium") {
      settingsRefs.fallRate.value = "120";
      settingsRefs.spawnInterval.value = "1000";
      settingsRefs.maxSimultaneous.value = "6";
    } else if (val === "hard") {
      settingsRefs.fallRate.value = "190";
      settingsRefs.spawnInterval.value = "700";
      settingsRefs.maxSimultaneous.value = "9";
    }

    syncSliderLabels();
    showMessage(`${val[0].toUpperCase()}${val.slice(1)} preset applied. Save settings to keep.`);
  }

  function syncSliderLabels() {
    settingsRefs.fallRateValue.textContent = `${settingsRefs.fallRate.value}px/s`;
    settingsRefs.spawnIntervalValue.textContent = `${settingsRefs.spawnInterval.value} ms`;
    settingsRefs.voiceRateValue.textContent = settingsRefs.voiceRate.value;
    settingsRefs.voicePitchValue.textContent = settingsRefs.voicePitch.value;
    settingsRefs.voiceVolumeValue.textContent = settingsRefs.voiceVolume.value;
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = state.settings.voiceRate;
    utter.pitch = state.settings.voicePitch;
    utter.volume = state.settings.voiceVolume;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }

  function playPopSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "triangle";
    osc.frequency.setValueAtTime(340, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.settings.theme === "colorSafe" ? "colorSafe" : "classic";
  }

  function showMessage(msg) {
    el.messageText.textContent = msg;
  }

  function getPoolForMode(mode) {
    if (mode === "numbers") {
      return NUMBERS;
    }
    if (mode === "mixed") {
      return [...LETTERS, ...NUMBERS];
    }
    if (mode === "confusion") {
      return CONFUSION;
    }
    return LETTERS;
  }

  function normalizeKey(key) {
    if (!key) {
      return "";
    }
    if (/^[a-z]$/i.test(key)) {
      return key.toUpperCase();
    }
    if (/^\d$/.test(key)) {
      return key;
    }
    return "";
  }

  function getMostMissed() {
    const entries = Object.entries(state.stats.missedBySymbol);
    if (!entries.length) {
      return "";
    }
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }

  function modeLabel(mode) {
    if (mode === "numbers") {
      return "1-10";
    }
    if (mode === "mixed") {
      return "Mixed";
    }
    if (mode === "confusion") {
      return "Confusion Set";
    }
    return "A-Z";
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem("balloonGameSettings");
      if (!raw) {
        return { ...DEFAULT_SETTINGS };
      }
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (_err) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function persistSettings() {
    localStorage.setItem("balloonGameSettings", JSON.stringify(state.settings));
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem("balloonGameStats");
      if (!raw) {
        return { totalPopped: 0, totalMissed: 0, playTimeSeconds: 0, missedBySymbol: {} };
      }
      return {
        totalPopped: 0,
        totalMissed: 0,
        playTimeSeconds: 0,
        missedBySymbol: {},
        ...JSON.parse(raw),
      };
    } catch (_err) {
      return { totalPopped: 0, totalMissed: 0, playTimeSeconds: 0, missedBySymbol: {} };
    }
  }

  function persistStats() {
    localStorage.setItem("balloonGameStats", JSON.stringify(state.stats));
  }

  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function $(id) {
    return document.getElementById(id);
  }
})();
