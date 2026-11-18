import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronRight,
  Crown,
  Flame,
  Gift,
  House,
  Key,
  MapPin,
  Palette as PaletteIcon,
  Share2,
  Target,
  Timer,
  Trophy,
  Vibrate,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import {
  createGame,
  DIFFICULTIES,
  INITIAL_SNAPSHOT,
  PALETTES,
  TITLES,
  type Difficulty,
  type Game,
  type Palette,
  type Snapshot,
} from "@/game/engine";
import { currentStreak, loadSave, todayKey, touchStreak, writeSave } from "@/game/save";
import { GIFTS, MAX_REVIVES, REVIVE_COST, giftFor, rewardText, type Reward } from "@/game/rewards";
import { postRun, retryPending, trackFinish, trackOpen, trackStart, visitorId, type Finish } from "@/game/track";
import { shareRun } from "@/game/share";
import { clearPlace, getBoard, savePlace, type BoardRow, type Period, type RunResult } from "@/lib/leaderboard";
import { InstallBanner } from "@/components/install-banner";
import { LeaderboardSheet } from "@/components/leaderboard-sheet";
import { NameForm } from "@/components/name-form";
import { GiftSheet } from "@/components/gift-sheet";
import { RewardArt } from "@/components/reward-art";

const CREDIT_URL = "https://berachaiah-portfolio.vercel.app/";

/** One-word read on each difficulty, for the pill subtitle. */
const DIFFICULTY_HINT: Record<Difficulty, string> = {
  easy: "Gentle",
  medium: "Classic",
  hard: "Tight",
};

function label(place: { country: string; region: string | null }) {
  return place.region ? `${place.region}, ${place.country}` : place.country;
}

export function GameScreen() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<Snapshot>(INITIAL_SNAPSHOT);
  const [name, setName] = useState<string | null>(null);
  const [showName, setShowName] = useState(false);
  const [boardTab, setBoardTab] = useState<Period | null>(null);
  const [place, setPlace] = useState<"on" | "off" | null>(null);
  const [placeText, setPlaceText] = useState("");
  const [askPlace, setAskPlace] = useState(false);
  const [streak, setStreak] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [rivals, setRivals] = useState<BoardRow[]>([]);
  const [shareNote, setShareNote] = useState("");
  const [percentile, setPercentile] = useState<{ beaten: number; total: number } | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [keys, setKeys] = useState(0);
  const [claimed, setClaimed] = useState(0);
  const [lastGift, setLastGift] = useState<string | null>(null);
  const [boost, setBoost] = useState(1);
  const [palette, setPalette] = useState<Palette>("shore");
  const [palettes, setPalettes] = useState<Palette[]>(["shore"]);
  const [revives, setRevives] = useState(0);
  const [giftNote, setGiftNote] = useState("");
  const [showGifts, setShowGifts] = useState(false);

  const snapRef = useRef(snap);
  snapRef.current = snap;
  const gateRef = useRef({ blocked: false });
  gateRef.current = { blocked: showName || boardTab !== null || showGifts };
  const nameRef = useRef<string | null>(name);
  nameRef.current = name;
  // An anonymous run waits here until a name is picked, then it is posted.
  const heldRun = useRef<Finish | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const save = loadSave();
    setName(save.name);
    setDifficulty(save.difficulty);
    setKeys(save.keys);
    setClaimed(save.gifts);
    setLastGift(save.lastGift);
    setBoost(save.boost);
    setPalette(save.palette);
    setPalettes(save.palettes);
    setPlace(save.place);
    setStreak(currentStreak());
    trackOpen();
    void retryPending();
    const game = createGame(canvas, root, setSnap);
    // The first run never asks for a name — the leaderboard asks after it.
    game.setGate(() => !gateRef.current.blocked);
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const runIdRef = useRef(0);
  const phaseRef = useRef(snap.phase);
  useEffect(() => {
    const from = phaseRef.current;
    phaseRef.current = snap.phase;
    const now = snapRef.current;
    if ((from === "menu" || from === "over") && snap.phase === "play") {
      setResult(null);
      setShareNote("");
      setPercentile(null);
      heldRun.current = null;
      // A revive also lands here, so the run's identity — not the phase —
      // decides when the key budget resets.
      if (now.runId !== runIdRef.current) {
        runIdRef.current = now.runId;
        setRevives(0);
      }
      trackStart(now.mode);
      if (nameRef.current) {
        const period: Period = now.mode === "daily" ? "day" : "all";
        getBoard({ data: { period, limit: 100, difficulty: now.difficulty } })
          .then((board) => setRivals(board.rows))
          .catch(() => setRivals([]));
      } else {
        setRivals([]);
      }
    }
    if (from === "play" && snap.phase === "over") {
      const run: Finish = {
        score: now.score,
        combo: now.maxCombo,
        drops: now.drops,
        seconds: now.seconds,
        perfects: now.perfects,
        mode: now.mode,
        difficulty: now.difficulty,
        boost: now.boost,
      };
      trackFinish(run);
      setStreak(touchStreak());
      if (now.boost > 1) {
        writeSave({ boost: 1 });
        setBoost(1);
      }
      if (now.score > 0) {
        // No name yet: hold the run and post it the moment one is picked.
        if (loadSave().name) {
          void postRun(run).then((res) => setResult(res));
        } else {
          heldRun.current = run;
        }
        const period: Period = now.mode === "daily" ? "day" : "all";
        void getBoard({ data: { period, limit: 100, score: now.score, difficulty: now.difficulty } })
          .then((board) => setPercentile(board.percentile))
          .catch(() => setPercentile(null));
        if (loadSave().place === null) setAskPlace(true);
      }
    }
  }, [snap.phase]);

  const shareLocation = useCallback(() => {
    setAskPlace(false);
    if (!("geolocation" in navigator)) {
      writeSave({ place: "off" });
      setPlace("off");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const visitor = visitorId();
        if (!visitor) return;
        try {
          // Rounded before it leaves the phone, and the server keeps only state and country.
          const found = await savePlace({
            data: {
              visitor,
              lat: Math.round(pos.coords.latitude * 10) / 10,
              lng: Math.round(pos.coords.longitude * 10) / 10,
            },
          });
          if (found) {
            writeSave({ place: "on" });
            setPlace("on");
            setPlaceText(label(found));
          } else {
            writeSave({ place: "off" });
            setPlace("off");
          }
        } catch {
          writeSave({ place: "off" });
          setPlace("off");
        }
      },
      () => {
        writeSave({ place: "off" });
        setPlace("off");
      },
      { timeout: 8000, maximumAge: 600000 },
    );
  }, []);

  const stopLocation = useCallback(() => {
    setAskPlace(false);
    writeSave({ place: "off" });
    setPlace("off");
    setPlaceText("");
    const visitor = visitorId();
    if (visitor) void clearPlace({ data: { visitor } }).catch(() => undefined);
  }, []);

  const start = () => {
    gameRef.current?.begin();
  };

  const changeDifficulty = (next: Difficulty) => {
    setDifficulty(next);
    gameRef.current?.setDifficulty(next);
  };

  const claimGift = () => {
    const save = loadSave();
    if (save.lastGift === todayKey()) return;
    const day = (save.gifts % GIFTS.length) + 1;
    const reward = giftFor(day);
    let nextKeys = save.keys;
    let nextBoost = save.boost;
    let nextPalette = save.palette;
    let nextPalettes = save.palettes;
    let note = `Day ${day}: ${rewardText(reward)}`;
    if (reward.kind === "keys") {
      nextKeys += reward.amount;
    } else if (reward.kind === "boost") {
      nextBoost = Math.max(nextBoost, reward.amount);
    } else if (save.palettes.includes(reward.palette)) {
      nextKeys += 4;
      note = `Day ${day}: ${reward.label} glass already open — 4 keys instead`;
    } else {
      nextPalettes = [...save.palettes, reward.palette];
      nextPalette = reward.palette;
      note = `Day ${day}: ${reward.label} glass unlocked`;
    }
    writeSave({
      keys: nextKeys,
      boost: nextBoost,
      palette: nextPalette,
      palettes: nextPalettes,
      gifts: save.gifts + 1,
      lastGift: todayKey(),
    });
    setKeys(nextKeys);
    setBoost(nextBoost);
    setPalette(nextPalette);
    setPalettes(nextPalettes);
    setClaimed(save.gifts + 1);
    setLastGift(todayKey());
    setGiftNote(note);
    gameRef.current?.setPalette(nextPalette);
  };

  const cyclePalette = () => {
    if (palettes.length < 2) return;
    const index = palettes.indexOf(palette);
    const next = palettes[(index + 1) % palettes.length];
    setPalette(next);
    writeSave({ palette: next });
    gameRef.current?.setPalette(next);
  };

  const keepStacking = () => {
    const save = loadSave();
    if (save.keys < REVIVE_COST || revives >= MAX_REVIVES) return;
    if (!gameRef.current?.revive()) return;
    writeSave({ keys: save.keys - REVIVE_COST });
    setKeys(save.keys - REVIVE_COST);
    setRevives(revives + 1);
    setGiftNote("");
  };

  const status =
    snap.phase === "menu"
      ? "Tideglass. Tap start to play."
      : snap.phase === "over"
        ? `Game over. Score ${snap.score}. Best ${snap.best}.`
        : `Score ${snap.score}. ${snap.title}.`;

  const above = rivals
    .filter((row) => row.name !== name && row.score > snap.score)
    .sort((a, b) => a.score - b.score)[0];
  const leading = rivals.length > 0 && !above && snap.score > 0;

  const nextTitle = TITLES.find(([at]) => at > snap.drops) ?? null;
  const titleStart = [...TITLES].reverse().find(([at]) => at <= snap.drops)?.[0] ?? 0;
  const titleProgress = nextTitle
    ? Math.min(1, Math.max(0, (snap.drops - titleStart) / Math.max(1, nextTitle[0] - titleStart)))
    : 1;
  const accuracy = snap.drops > 0 ? Math.round((snap.perfects / snap.drops) * 100) : 0;
  const clock =
    snap.seconds >= 60
      ? `${Math.floor(snap.seconds / 60)}:${String(snap.seconds % 60).padStart(2, "0")}`
      : `${snap.seconds}s`;
  const percent =
    percentile && percentile.total > 1
      ? Math.round((percentile.beaten / percentile.total) * 100)
      : null;
  const giftDay = (claimed % GIFTS.length) + 1;
  const bannerReward = giftFor(giftDay);
  const canClaimGift = lastGift !== todayKey();
  const percentileLine =
    percent === null
      ? null
      : percent > 0
        ? `Better than ${percent}% of ${percentile?.total ?? 0} players${snap.mode === "daily" ? " today" : ""}`
        : "Everyone is ahead of you — one more run.";

  const modeButton = (mode: "free" | "daily", text: string) => (
    <button
      type="button"
      aria-pressed={snap.mode === mode}
      className={`min-h-10 flex-1 rounded-full px-3 text-sm font-medium transition ${
        snap.mode === mode ? "bg-foam text-ink" : "text-mist hover:text-foam"
      }`}
      onClick={() => gameRef.current?.setMode(mode)}
    >
      {text}
    </button>
  );

  return (
    <div
      ref={rootRef}
      className="relative h-dvh w-full touch-none overflow-hidden bg-tide text-foam select-none"
    >
      <canvas ref={canvasRef} className="absolute inset-0 z-0 h-full w-full" aria-hidden />
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        <header className="safe-pad pointer-events-auto mx-auto flex w-full max-w-md items-start justify-between sm:max-w-3xl">
          {snap.phase === "play" ? (
            <div>
              <p key={snap.score} className="score-pop font-serif text-5xl leading-none tabular-nums">
                {snap.score}
              </p>
              <p className="mt-1 text-xs font-medium tracking-widest text-mist uppercase">
                {snap.title}
                {snap.mode === "daily" ? " · daily tide" : ""}
              </p>
              {snap.boost > 1 ? (
                <p className="mt-1 text-xs font-medium text-ember tabular-nums">×{snap.boost} score</p>
              ) : null}
              {snap.score === 0 ? <p className="mt-2 text-sm font-medium text-foam">Tap to drop</p> : null}
              {snap.combo > 1 ? (
                <p className="text-sm font-medium text-ember tabular-nums">×{snap.combo} streak</p>
              ) : null}
              {snap.second ? <p className="mt-1 text-xs text-mist">Second chance ready</p> : null}
              {above ? (
                <p className="mt-1 max-w-[16rem] truncate text-xs text-mist tabular-nums">
                  Next: {above.name} · {above.score - snap.score} to go
                </p>
              ) : leading ? (
                <p className="mt-1 text-xs text-ember">You lead the board</p>
              ) : null}
            </div>
          ) : (
            <span />
          )}
          <div className="flex shrink-0 items-center gap-2">
            {snap.phase !== "menu" ? (
              <button
                type="button"
                aria-label="Main menu"
                className="btn-ghost grid size-11 place-items-center rounded-full"
                onClick={() => {
                  setShowName(false);
                  setBoardTab(null);
                  setShowGifts(false);
                  gameRef.current?.home();
                }}
              >
                <House className="size-5" strokeWidth={1.75} />
              </button>
            ) : null}
            <button
              type="button"
              aria-label={snap.sound ? "Mute sound" : "Unmute sound"}
              aria-pressed={!snap.sound}
              className="btn-ghost grid size-11 place-items-center rounded-full"
              onClick={() => gameRef.current?.toggleSound()}
            >
              {snap.sound ? <Volume2 className="size-5" strokeWidth={1.75} /> : <VolumeX className="size-5" strokeWidth={1.75} />}
            </button>
          </div>
        </header>

        <div className="flex-1" />

        {snap.phase === "menu" ? <InstallBanner /> : null}

        {snap.phase !== "play" ? (
          <div className="safe-bottom pointer-events-none flex justify-center sm:items-center sm:px-6 sm:pb-8">
            <section className="sheet sheet-in glass pointer-events-auto max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl px-6 pt-6 pb-6 sm:max-h-[min(92dvh,52rem)] sm:max-w-lg sm:rounded-[2rem] sm:px-7 sm:pt-7 sm:pb-7 lg:max-w-xl">
              {showName ? (
                <NameForm
                  onDone={(chosen) => {
                    setName(chosen);
                    setShowName(false);
                    const held = heldRun.current;
                    if (held) {
                      heldRun.current = null;
                      void postRun(held).then((res) => setResult(res));
                    }
                  }}
                  onGuest={() => {
                    writeSave({ guest: true });
                    setShowName(false);
                  }}
                />
              ) : snap.phase === "menu" ? (
                <>
                  <p className="flex items-center gap-2 text-[10px] font-medium tracking-[0.3em] text-ember uppercase">
                    <span className="size-1 rounded-full bg-ember" />
                    One tap · the tide turns
                  </p>
                  <h1 className="mt-2 font-serif text-[3.3rem] leading-[0.9] font-semibold tracking-tight text-balance">
                    Tideglass
                  </h1>
                  <p className="mt-2 max-w-[19rem] text-sm leading-relaxed text-pretty text-mist">
                    Stack sea glass on the shelf. A clean landing keeps it whole.
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Stat icon={<Key className="size-4" strokeWidth={1.8} />} value={keys} label="keys" />
                    <Stat
                      icon={<Flame className="size-4" strokeWidth={1.8} />}
                      value={streak}
                      label="day streak"
                    />
                    <Stat
                      icon={<Zap className="size-4" strokeWidth={1.8} />}
                      value={boost > 1 ? `×${boost}` : "—"}
                      label="next run"
                    />
                  </div>

                  <div className="mt-3 rounded-full border border-foam/10 bg-ink/45 p-1">
                    <div className="grid grid-cols-2 gap-1">
                      {modeButton("free", "Free play")}
                      {modeButton("daily", "Daily tide")}
                    </div>
                  </div>
                  {snap.mode === "daily" ? (
                    <p className="mt-2 text-center text-[11px] text-mist">
                      One pattern for everyone today · own board
                    </p>
                  ) : null}

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(Object.keys(DIFFICULTIES) as Difficulty[]).map((id) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={snap.difficulty === id}
                        className={`flex min-h-12 flex-col items-center justify-center rounded-2xl border transition ${
                          snap.difficulty === id
                            ? "border-foam/40 bg-foam/12 text-foam"
                            : "border-foam/10 text-mist"
                        }`}
                        onClick={() => changeDifficulty(id)}
                      >
                        <span className="text-sm font-semibold">{DIFFICULTIES[id].label}</span>
                        <span className="mt-0.5 text-[9px] tracking-[0.14em] uppercase opacity-60">
                          {DIFFICULTY_HINT[id]}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-center text-[11px] leading-snug text-pretty text-mist">
                    {DIFFICULTIES[snap.difficulty].note}
                  </p>
                  {canClaimGift ? (
                    <button
                      type="button"
                      className="sheen tile-lit mt-3 flex w-full items-center gap-3 overflow-hidden rounded-2xl p-2.5 text-left"
                      onClick={() => setShowGifts(true)}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ember/15">
                        <GiftArt reward={bannerReward} className="size-7" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-semibold tracking-[0.2em] text-ember uppercase">
                          Day {giftDay} gift ready
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-foam">
                          {rewardText(giftFor(giftDay))}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-ember" strokeWidth={2} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="tile mt-3 flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl px-3 text-left"
                      onClick={() => setShowGifts(true)}
                    >
                      <span className="flex items-center gap-2 text-[11px] text-mist">
                        <Gift className="size-4" strokeWidth={1.7} />
                        Daily gifts · day {giftDay}
                      </span>
                      <span className="text-[10px] tracking-[0.12em] text-mist/70 uppercase">tomorrow</span>
                    </button>
                  )}
                  {giftNote ? (
                    <p className="mt-2 text-center text-[11px] text-ember">{giftNote}</p>
                  ) : null}
                  <button
                    type="button"
                    className="btn-ember sheen mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full text-lg font-semibold"
                    onClick={start}
                  >
                    Start stacking
                    <ArrowRight className="size-5" strokeWidth={2.2} />
                  </button>
                  <p className="mt-2 text-center text-[11px] text-mist">
                    {snap.best > 0 ? <span className="tabular-nums">Best {snap.best} · </span> : null}
                    Tap, click or space
                  </p>

                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <ToolButton
                      icon={<Trophy className="size-4" strokeWidth={1.8} />}
                      label="Board"
                      onClick={() => setBoardTab(snap.mode === "daily" ? "day" : "all")}
                    />
                    <ToolButton
                      icon={<Vibrate className="size-4" strokeWidth={1.8} />}
                      label={snap.shake ? "Shake on" : "Shake off"}
                      onClick={() => gameRef.current?.toggleShake()}
                    />
                    <ToolButton
                      icon={<MapPin className="size-4" strokeWidth={1.8} />}
                      label={place === "on" ? "Place on" : "Place off"}
                      onClick={() => (place === "on" ? stopLocation() : shareLocation())}
                    />
                    <ToolButton
                      icon={<PaletteIcon className="size-4" strokeWidth={1.8} />}
                      label={PALETTES[palette].label}
                      disabled={palettes.length < 2}
                      onClick={cyclePalette}
                    />
                  </div>

                  <p className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 text-center text-[11px] text-mist">
                    {name ? (
                      <>
                        <span>{name}</span>
                        <button type="button" className="min-h-11 px-1 underline" onClick={() => setShowName(true)}>
                          change
                        </button>
                      </>
                    ) : (
                      <button type="button" className="min-h-11 px-1 underline" onClick={() => setShowName(true)}>
                        Pick a name to join the leaderboard
                      </button>
                    )}
                    {place === "on" && placeText ? <span>· {placeText}</span> : null}
                    <span className="text-mist/50">·</span>
                    <a href={CREDIT_URL} target="_blank" rel="noopener noreferrer" className="underline">
                      The Best
                    </a>
                  </p>
                </>
              ) : (
                <>
                  <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.28em] text-ember uppercase">
                    {snap.crowned && snap.score > 0 ? <Crown className="size-3.5" strokeWidth={1.9} /> : null}
                    {snap.crowned && snap.score > 0 ? "New best" : snap.mode === "daily" ? "Daily tide" : "Slipped"}
                  </p>
                  <div className="mt-1 flex items-end justify-between gap-3">
                    <p className="font-serif text-[4.2rem] leading-[0.82] font-semibold tracking-tight tabular-nums">
                      {snap.score}
                    </p>
                    {result?.ok ? (
                      <span className="mb-1 shrink-0 rounded-full border border-foam/15 bg-foam/[0.06] px-2.5 py-1 text-[10px] font-medium text-foam tabular-nums">
                        Rank {result.rank} of {result.total}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-mist tabular-nums">
                    {snap.title} · {DIFFICULTIES[snap.difficulty].label} · Best {snap.best}
                  </p>
                  {snap.score === 0 ? (
                    <p className="mt-3 text-base text-pretty text-mist">It has to catch the pane underneath.</p>
                  ) : (
                    <>
                      <dl className="mt-3 grid grid-cols-3 gap-2">
                        <div className="tile rounded-2xl px-1 py-2.5 text-center">
                          <dt className="flex items-center justify-center gap-1 text-[9px] font-medium tracking-[0.12em] text-mist uppercase">
                            <Flame className="size-3" strokeWidth={2} />
                            Combo
                          </dt>
                          <dd className="mt-1.5 font-serif text-2xl leading-none tabular-nums">
                            ×{snap.maxCombo}
                          </dd>
                        </div>
                        <div className="tile rounded-2xl px-1 py-2.5 text-center">
                          <dt className="flex items-center justify-center gap-1 text-[9px] font-medium tracking-[0.12em] text-mist uppercase">
                            <Target className="size-3" strokeWidth={2} />
                            Perfect
                          </dt>
                          <dd className="mt-1.5 font-serif text-2xl leading-none tabular-nums">{accuracy}%</dd>
                        </div>
                        <div className="tile rounded-2xl px-1 py-2.5 text-center">
                          <dt className="flex items-center justify-center gap-1 text-[9px] font-medium tracking-[0.12em] text-mist uppercase">
                            <Timer className="size-3" strokeWidth={2} />
                            Time
                          </dt>
                          <dd className="mt-1.5 font-serif text-2xl leading-none tabular-nums">{clock}</dd>
                        </div>
                      </dl>
                      {nextTitle ? (
                        <div className="mt-3">
                          <p className="flex items-baseline justify-between gap-3 text-xs text-mist">
                            <span>{snap.title}</span>
                            <span className="tabular-nums">
                              {nextTitle[0] - snap.drops} drops to {nextTitle[1]}
                            </span>
                          </p>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foam/10">
                            <div
                              className="h-full rounded-full bg-ember"
                              style={{ width: `${Math.round(titleProgress * 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-ember">Tidecrown reached. The stack is yours.</p>
                      )}
                      {percentileLine ? (
                        <p className="mt-3 text-sm text-foam tabular-nums">{percentileLine}</p>
                      ) : null}
                    </>
                  )}
                  {result && !result.ok ? (
                    <p className="mt-2 text-[11px] text-mist">Not posted: {result.error}</p>
                  ) : !name && snap.score > 0 ? (
                    <button
                      type="button"
                      className="mt-3 min-h-11 text-sm text-foam underline"
                      onClick={() => setShowName(true)}
                    >
                      Put a name on this score
                    </button>
                  ) : null}

                  {askPlace ? (
                    <div className="mt-3 rounded-2xl border border-foam/10 bg-tide/70 p-4">
                      <p className="text-sm font-medium">Share your state and country?</p>
                      <p className="mt-1 text-xs text-pretty text-mist">
                        Only your state and country are kept, for the creator's stats. Your exact location is never stored and is not shown next to your name.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" className="min-h-11 flex-1 rounded-full bg-foam text-sm font-semibold text-ink" onClick={shareLocation}>
                          Share
                        </button>
                        <button type="button" className="min-h-11 flex-1 rounded-full bg-foam/10 text-sm text-mist" onClick={stopLocation}>
                          No thanks
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {keys > 0 && revives < MAX_REVIVES ? (
                    <button
                      type="button"
                      className="tile-lit mt-3 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition active:scale-[0.995]"
                      onClick={keepStacking}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ember/15 text-ember">
                        <Key className="size-5" strokeWidth={1.7} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foam">Keep stacking</span>
                        <span className="mt-0.5 block truncate text-[11px] text-mist tabular-nums">
                          Spend {REVIVE_COST} key · {keys} left · {MAX_REVIVES - revives} this run
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-ember" strokeWidth={2} />
                    </button>
                  ) : (
                    <p className="tile mt-3 rounded-2xl px-3 py-2.5 text-center text-[11px] text-mist">
                      {revives >= MAX_REVIVES
                        ? "No more keys this run."
                        : "Gifts earn keys that keep a run alive."}
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn-ember sheen mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-full text-lg font-semibold"
                    onClick={start}
                  >
                    Stack again
                  </button>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    {snap.score > 0 ? (
                      <ActionChip
                        icon={<Share2 className="size-3.5" strokeWidth={1.9} />}
                        label="Share"
                        onClick={() => {
                          void shareRun({ name, score: snap.score, title: snap.title, mode: snap.mode, drops: snap.drops }).then((r) =>
                            setShareNote(r === "saved" ? "Image saved" : ""),
                          );
                        }}
                      />
                    ) : null}
                    <ActionChip
                      icon={<Trophy className="size-3.5" strokeWidth={1.9} />}
                      label="Leaderboard"
                      onClick={() => setBoardTab(snap.mode === "daily" ? "day" : "all")}
                    />
                    <ActionChip
                      icon={<Vibrate className="size-3.5" strokeWidth={1.9} />}
                      label={snap.shake ? "Shake on" : "Shake off"}
                      onClick={() => gameRef.current?.toggleShake()}
                    />
                  </div>
                  {shareNote ? <p className="text-center text-xs text-mist">{shareNote}</p> : null}
                </>
              )}
            </section>
          </div>
        ) : null}
      </div>

      {boardTab ? (
        <LeaderboardSheet
          name={name}
          initial={boardTab}
          difficulty={difficulty}
          onClose={() => setBoardTab(null)}
        />
      ) : null}

      {showGifts ? (
        <GiftSheet
          claimed={claimed}
          canClaim={canClaimGift}
          streak={streak}
          onClaim={claimGift}
          onClose={() => setShowGifts(false)}
        />
      ) : null}
    </div>
  );
}

/** Reward art for a gift, with glass gems tinted by their palette. */
function GiftArt({ reward, className }: { reward: Reward; className?: string }) {
  if (reward.kind === "palette") {
    const [r, g, b] = PALETTES[reward.palette].colors[0];
    return <RewardArt kind="palette" color={`rgb(${r} ${g} ${b})`} className={className} />;
  }
  return <RewardArt kind={reward.kind} className={className} />;
}

/** One of the three economy counters on the menu. */
function Stat({ icon, value, label }: { icon: ReactNode; value: number | string; label: string }) {
  return (
    <div className="tile flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5">
      <span className="text-mist">{icon}</span>
      <span className="font-serif text-xl leading-none font-semibold tabular-nums">{value}</span>
      <span className="text-[9px] font-medium tracking-[0.14em] text-mist uppercase">{label}</span>
    </div>
  );
}

/** Small square action in the menu toolbar. */
function ToolButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="tile flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-mist transition hover:text-foam disabled:opacity-40"
      onClick={onClick}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

/** Secondary action under the game-over CTA. */
function ActionChip({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="btn-ghost flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
