import { useCallback, useEffect, useRef, useState } from "react";
import { Gift, Key, Volume2, VolumeX } from "lucide-react";
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
import { GIFTS, MAX_REVIVES, REVIVE_COST, giftFor, rewardText } from "@/game/rewards";
import { postRun, retryPending, trackFinish, trackOpen, trackStart, visitorId, type Finish } from "@/game/track";
import { shareRun } from "@/game/share";
import { clearPlace, getBoard, savePlace, type BoardRow, type Period, type RunResult } from "@/lib/leaderboard";
import { InstallBanner } from "@/components/install-banner";
import { LeaderboardSheet } from "@/components/leaderboard-sheet";
import { NameForm } from "@/components/name-form";
import { GiftSheet } from "@/components/gift-sheet";

const CREDIT_URL = "https://berachaiah-portfolio.vercel.app/";

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
      className={`min-h-11 flex-1 rounded-full px-3 text-sm font-medium ${
        snap.mode === mode ? "bg-foam text-ink" : "bg-foam/10 text-mist"
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
        <header className="safe-pad pointer-events-auto flex items-start justify-between">
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
          <button
            type="button"
            aria-label={snap.sound ? "Mute sound" : "Unmute sound"}
            aria-pressed={!snap.sound}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/55 text-foam"
            onClick={() => gameRef.current?.toggleSound()}
          >
            {snap.sound ? <Volume2 className="size-5" strokeWidth={1.75} /> : <VolumeX className="size-5" strokeWidth={1.75} />}
          </button>
        </header>

        <div className="flex-1" />

        {snap.phase === "menu" ? <InstallBanner /> : null}

        {snap.phase !== "play" ? (
          <div className="safe-bottom pointer-events-none flex justify-center">
            <section className="sheet sheet-in pointer-events-auto max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-foam/10 bg-ink/95 px-6 pt-6 pb-6 shadow-2xl backdrop-blur-xl">
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
                  <p className="text-xs font-medium tracking-widest text-ember uppercase">One tap</p>
                  <h1 className="mt-2 font-serif text-5xl leading-none font-semibold text-balance">Tideglass</h1>
                  <p className="mt-3 text-base leading-relaxed text-pretty text-mist">
                    Drop each pane of sea glass onto the last. A clean landing keeps it whole. Miss, and it slips into the tide.
                  </p>
                  <div className="mt-4 flex gap-2">
                    {modeButton("free", "Free play")}
                    {modeButton("daily", "Daily tide")}
                  </div>
                  {snap.mode === "daily" ? (
                    <p className="mt-2 text-xs text-mist">One pattern for everyone today. Own board.</p>
                  ) : null}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {(Object.keys(DIFFICULTIES) as Difficulty[]).map((id) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={snap.difficulty === id}
                        className={`min-h-12 rounded-xl text-sm font-semibold ${
                          snap.difficulty === id
                            ? "bg-foam text-ink"
                            : "border border-foam/15 text-mist"
                        }`}
                        onClick={() => changeDifficulty(id)}
                      >
                        {DIFFICULTIES[id].label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-mist">{DIFFICULTIES[snap.difficulty].note}</p>
                  {canClaimGift ? (
                    <button
                      type="button"
                      className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-ember/50 bg-ember/10 text-sm font-semibold text-ember"
                      onClick={() => setShowGifts(true)}
                    >
                      <Gift className="size-4" strokeWidth={1.75} />
                      Day {giftDay} gift ready
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="mt-4 min-h-11 w-full text-sm text-mist underline"
                      onClick={() => setShowGifts(true)}
                    >
                      Daily gifts · day {giftDay}
                    </button>
                  )}
                  {giftNote ? (
                    <p className="mt-1 text-center text-xs text-ember">{giftNote}</p>
                  ) : null}
                  <button
                    type="button"
                    className="mt-4 flex h-14 w-full items-center justify-center rounded-full bg-ember text-lg font-semibold text-ink"
                    onClick={start}
                  >
                    Start stacking
                  </button>
                  <p className="mt-3 text-center text-sm text-mist">
                    {snap.best > 0 ? <span className="tabular-nums">Best {snap.best} · </span> : null}
                    {streak > 1 ? <span className="tabular-nums">{streak} day streak · </span> : null}
                    {boost > 1 ? <span className="tabular-nums">×{boost} score · </span> : null}
                    {keys > 0 ? <span className="tabular-nums">{keys} keys · </span> : null}
                    Tap, click, or space
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-1">
                    <button type="button" className="min-h-11 px-3 text-sm text-foam underline" onClick={() => setBoardTab(snap.mode === "daily" ? "day" : "all")}>
                      Leaderboard
                    </button>
                    <button type="button" className="min-h-11 px-3 text-sm text-mist" onClick={() => gameRef.current?.toggleShake()}>
                      Shake {snap.shake ? "on" : "off"}
                    </button>
                    <button
                      type="button"
                      className="min-h-11 px-3 text-sm text-mist"
                      onClick={() => (place === "on" ? stopLocation() : shareLocation())}
                    >
                      Location {place === "on" ? "on" : "off"}
                    </button>
                  </div>
                  {palettes.length > 1 ? (
                    <button
                      type="button"
                      className="mt-1 min-h-11 w-full text-sm text-mist"
                      onClick={cyclePalette}
                    >
                      Glass: {PALETTES[palette].label}
                    </button>
                  ) : null}
                  <p className="text-center text-xs text-mist">
                    {name ? (
                      <>
                        Playing as {name}{" "}
                        <button type="button" className="min-h-11 px-1 underline" onClick={() => setShowName(true)}>
                          Change
                        </button>
                      </>
                    ) : (
                      <button type="button" className="min-h-11 px-1 underline" onClick={() => setShowName(true)}>
                        Pick a name to join the leaderboard
                      </button>
                    )}
                    {place === "on" && placeText ? <span> · {placeText}</span> : null}
                  </p>
                  <p className="mt-1 text-center text-xs text-mist">
                    Made by{" "}
                    <a href={CREDIT_URL} target="_blank" rel="noopener noreferrer" className="underline">
                      The Best
                    </a>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium tracking-widest text-ember uppercase">
                    {snap.crowned && snap.score > 0 ? "New best" : snap.mode === "daily" ? "Daily tide" : "Slipped"}
                  </p>
                  <p className="mt-2 font-serif text-6xl leading-none font-semibold tabular-nums">{snap.score}</p>
                  <p className="mt-2 text-sm text-mist tabular-nums">
                    {snap.title} · {DIFFICULTIES[snap.difficulty].label} · Best {snap.best}
                  </p>
                  {snap.score === 0 ? (
                    <p className="mt-3 text-base text-pretty text-mist">It has to catch the pane underneath.</p>
                  ) : (
                    <>
                      <dl className="mt-4 grid grid-cols-3 gap-2 border-y border-foam/10 py-3">
                        <div className="text-center">
                          <dt className="text-[11px] font-medium tracking-widest text-mist uppercase">Best combo</dt>
                          <dd className="mt-1 font-serif text-2xl leading-none tabular-nums">
                            ×{snap.maxCombo}
                          </dd>
                        </div>
                        <div className="text-center">
                          <dt className="text-[11px] font-medium tracking-widest text-mist uppercase">Perfect</dt>
                          <dd className="mt-1 font-serif text-2xl leading-none tabular-nums">{accuracy}%</dd>
                        </div>
                        <div className="text-center">
                          <dt className="text-[11px] font-medium tracking-widest text-mist uppercase">Time</dt>
                          <dd className="mt-1 font-serif text-2xl leading-none tabular-nums">{clock}</dd>
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
                  {result?.ok ? (
                    <p className="mt-2 text-sm text-foam tabular-nums">
                      Rank {result.rank} of {result.total}
                      {snap.mode === "daily" ? " today" : ""}
                    </p>
                  ) : result && !result.ok ? (
                    <p className="mt-2 text-sm text-mist">Not posted: {result.error}</p>
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
                      className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-ember/60 bg-ember/10 text-sm font-semibold text-ember"
                      onClick={keepStacking}
                    >
                      <Key className="size-4" strokeWidth={1.75} />
                      Keep stacking · {REVIVE_COST} key · {keys} left
                    </button>
                  ) : (
                    <p className="mt-3 text-center text-xs text-mist">
                      {revives >= MAX_REVIVES
                        ? "No more keys this run."
                        : "Gifts earn keys that keep a run alive."}
                    </p>
                  )}
                  <button
                    type="button"
                    className="mt-5 flex h-14 w-full items-center justify-center rounded-full bg-ember text-lg font-semibold text-ink"
                    onClick={start}
                  >
                    Stack again
                  </button>
                  <div className="mt-2 flex items-center justify-center gap-1">
                    {snap.score > 0 ? (
                      <button
                        type="button"
                        className="min-h-11 px-3 text-sm text-foam underline"
                        onClick={() => {
                          void shareRun({ name, score: snap.score, title: snap.title, mode: snap.mode, drops: snap.drops }).then((r) =>
                            setShareNote(r === "saved" ? "Image saved" : ""),
                          );
                        }}
                      >
                        Share
                      </button>
                    ) : null}
                    <button type="button" className="min-h-11 px-3 text-sm text-foam underline" onClick={() => setBoardTab(snap.mode === "daily" ? "day" : "all")}>
                      Leaderboard
                    </button>
                    <button type="button" className="min-h-11 px-3 text-sm text-mist" onClick={() => gameRef.current?.toggleShake()}>
                      Shake {snap.shake ? "on" : "off"}
                    </button>
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
          onClaim={claimGift}
          onClose={() => setShowGifts(false)}
        />
      ) : null}
    </div>
  );
}
