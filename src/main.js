import { createListen, describeSchedule, loadListenSettings } from "./morse/listen.js";
import { createPlayer } from "./morse/player.js";
import { createPractice } from "./morse/practice.js";
import { createReference } from "./morse/reference.js";
import { createTrainer } from "./morse/trainer.js";

const pageMorse = document.getElementById("page-morse");

/** @type {ReturnType<typeof createTrainer> | null} */
let morseTrainer = null;
/** @type {ReturnType<typeof createPractice> | null} */
let morsePractice = null;
/** @type {ReturnType<typeof createListen> | null} */
let morseListen = null;
/** @type {ReturnType<typeof createReference> | null} */
let morseReference = null;
const MORSE_MODE_KEY = "morse.mode";
const MORSE_MODES = ["free", "practice", "listen"];

openMorse();

function openMorse() {
  if (!morseTrainer) {
    morseTrainer = createTrainer({
      boardMount: document.getElementById("morse-board"),
      messageEl: document.getElementById("morse-message"),
      statusEl: document.getElementById("morse-status"),
      paddleBtn: document.getElementById("btn-morse-key"),
      ditBtn: document.getElementById("btn-morse-dit"),
      dahBtn: document.getElementById("btn-morse-dah"),
      muteBtn: document.getElementById("btn-morse-mute"),
      recordBtn: document.getElementById("btn-morse-record"),
      playBtn: document.getElementById("btn-morse-play"),
      clearBtn: document.getElementById("btn-morse-clear"),
      onKeyDown: () => morsePractice?.handleKeyDown(),
      onCommit: (token) => {
        const accepted = morsePractice?.handleCommit(token) ?? true;
        if (accepted !== false) morseReference?.highlight(token.replace(/[<>]/g, ""), "keyed");
        return accepted;
      },
      onWordGap: () => morsePractice?.handleWordGap(),
    });
    const trainer = morseTrainer;
    const player = createPlayer({
      toneOn: () => trainer.toneOn(),
      toneOff: () => trainer.toneOff(),
      showPath: (ids, currentId) => trainer.showPath(ids, currentId),
      clearPath: () => trainer.clearPath(),
      setSegmentMs: (ms) => trainer.setSegmentMs(ms),
      setLocked: (locked) => trainer.setExternalPlayback(locked),
      onChar: (span) =>
        morseReference?.highlight(span ? span.token.replace(/[<>]/g, "") : null, "playing"),
    });
    morseReference = createReference(document.getElementById("morse-reference"), {
      onPick: (token) => {
        if (morsePractice?.isRunning()) return;
        const settings = loadListenSettings();
        player.play([[token]], settings, {
          onStart: (s) => morseReference?.showStrip(token, s, describeSchedule(s, settings)),
          onFrame: (ms) => morseReference?.drawStrip(ms),
          onDone: () => morseReference?.endStrip(),
        });
      },
    });
    morsePractice = createPractice({
      root: document.getElementById("morse-practice"),
      setHint: (ids) => trainer.setHint(ids),
      flashError: () => trainer.flashError(),
      errorBeep: () => trainer.errorBeep(),
      player,
      setExpected: (token) =>
        morseReference?.highlight(token ? token.replace(/[<>]/g, "") : null, "expected"),
    });
    morseListen = createListen({
      root: document.getElementById("morse-listen"),
      player,
      onKeyItNow: (category) => {
        morsePractice?.setCategory(category);
        setMorseMode("practice");
      },
    });
    for (const btn of pageMorse.querySelectorAll(".morse-mode-btn")) {
      btn.addEventListener("click", () => {
        setMorseMode(btn.dataset.mode);
        btn.blur();
      });
    }
    window.addEventListener("resize", () => {
      morsePractice?.resize();
      morseListen?.resize();
    });
  }
  morseTrainer.activate();
  let savedMode = "free";
  try {
    savedMode = localStorage.getItem(MORSE_MODE_KEY) || "free";
  } catch {
    /* storage unavailable */
  }
  setMorseMode(MORSE_MODES.includes(savedMode) ? savedMode : "free");
  // Ensure canvas board sizes to the visible page
  requestAnimationFrame(() => {
    morseTrainer?.resize?.();
  });
}

/** @param {"free" | "practice" | "listen"} next */
function setMorseMode(next) {
  if (!morseTrainer || !morsePractice || !morseListen) return;
  pageMorse.classList.toggle("is-practice", next === "practice");
  pageMorse.classList.toggle("is-listen", next === "listen");
  for (const btn of pageMorse.querySelectorAll(".morse-mode-btn")) {
    btn.setAttribute("aria-pressed", btn.dataset.mode === next ? "true" : "false");
  }
  if (next !== "practice") morsePractice.deactivate();
  if (next !== "listen") morseListen.deactivate();
  morseReference?.highlight(null, "keyed");
  morseTrainer.setMode(next);
  if (next === "practice") morsePractice.activate();
  if (next === "listen") morseListen.activate();
  try {
    localStorage.setItem(MORSE_MODE_KEY, next);
  } catch {
    /* storage unavailable */
  }
}
