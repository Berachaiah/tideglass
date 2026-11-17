import { createGame, INITIAL_SNAPSHOT, type Game, type Snapshot } from "@/game/engine";

const root = document.getElementById("app");
const canvas = document.getElementById("board");
if (!root || !(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Tideglass failed to start");
}

const scoreEl = document.getElementById("score")!;
const bestPlayEl = document.getElementById("best-play")!;
const hintEl = document.getElementById("hint")!;
const comboEl = document.getElementById("combo")!;
const playHud = document.getElementById("play-hud")!;
const playSpacer = document.getElementById("play-spacer")!;
const soundBtn = document.getElementById("sound")!;
const sheet = document.getElementById("sheet")!;
const kicker = document.getElementById("kicker")!;
const title = document.getElementById("title")!;
const blurb = document.getElementById("blurb")!;
const scoreBig = document.getElementById("score-big")!;
const bestLine = document.getElementById("best-line")!;
const missNote = document.getElementById("miss-note")!;
const primary = document.getElementById("primary")!;
const startHint = document.getElementById("start-hint")!;
const shakeBtn = document.getElementById("shake")!;
const homeHint = document.getElementById("home-hint")!;
const live = document.getElementById("live")!;

let game: Game | null = null;

function paint(snap: Snapshot) {
  const playing = snap.phase === "play";
  playHud.hidden = !playing;
  playSpacer.hidden = playing;
  sheet.hidden = playing;
  scoreEl.textContent = String(snap.score);
  bestPlayEl.textContent = `Best ${snap.best}`;
  hintEl.hidden = snap.score !== 0;
  comboEl.hidden = snap.combo <= 1;
  comboEl.textContent = `×${snap.combo} streak`;
  soundBtn.setAttribute("aria-label", snap.sound ? "Mute sound" : "Unmute sound");
  soundBtn.setAttribute("aria-pressed", String(!snap.sound));
  soundBtn.textContent = snap.sound ? "♪" : "×";
  shakeBtn.textContent = `Screen shake ${snap.shake ? "on" : "off"}`;

  if (snap.phase === "menu") {
    kicker.textContent = "One tap";
    title.hidden = false;
    blurb.hidden = false;
    scoreBig.hidden = true;
    bestLine.hidden = true;
    missNote.hidden = true;
    primary.textContent = "Start stacking";
    startHint.hidden = false;
    startHint.textContent = snap.best > 0 ? `Best ${snap.best} · Tap, click, or space` : "Tap, click, or space";
    homeHint.hidden = false;
    live.textContent = "Tideglass. Tap start to play.";
  } else if (snap.phase === "over") {
    kicker.textContent = snap.crowned && snap.score > 0 ? "New best" : "Slipped";
    title.hidden = true;
    blurb.hidden = true;
    scoreBig.hidden = false;
    scoreBig.textContent = String(snap.score);
    bestLine.hidden = false;
    bestLine.textContent = `Best ${snap.best}`;
    missNote.hidden = snap.score !== 0;
    primary.textContent = "Stack again";
    startHint.hidden = true;
    homeHint.hidden = true;
    live.textContent = `Game over. Score ${snap.score}. Best ${snap.best}.`;
  } else {
    live.textContent = `Score ${snap.score}. Best ${snap.best}.`;
  }
}

paint(INITIAL_SNAPSHOT);
game = createGame(canvas, root, paint);

primary.addEventListener("click", () => game?.begin());
soundBtn.addEventListener("click", () => game?.toggleSound());
shakeBtn.addEventListener("click", () => game?.toggleShake());
