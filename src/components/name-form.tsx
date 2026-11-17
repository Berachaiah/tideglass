import { useState } from "react";
import { claimName } from "@/lib/leaderboard";
import { checkName, graphemes, NAME_MAX } from "@/lib/names";
import { newToken, writeSave } from "@/game/save";

const PICKS = ["🌊", "🐚", "⚓", "🌙", "✨", "🔥", "🦊", "🐙", "💎", "🌴", "🏆", "😎"];

export function NameForm({
  onDone,
  onGuest,
}: {
  onDone: (name: string) => void;
  onGuest: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const count = graphemes(value.normalize("NFKC").trim()).length;

  async function submit() {
    const checked = checkName(value);
    if (!checked.ok) {
      setError(checked.reason);
      return;
    }
    setBusy(true);
    setError("");
    const token = newToken();
    try {
      const result = await claimName({ data: { name: checked.name, token } });
      if (result.ok) {
        writeSave({ name: result.name, token, guest: false });
        onDone(result.name);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Could not reach the server. Try again, or play without a name.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="text-xs font-medium tracking-widest text-ember uppercase">Your name</p>
      <h2 className="mt-2 font-serif text-3xl leading-tight font-semibold">Pick a name for the leaderboard</h2>
      <p className="mt-2 text-sm text-pretty text-mist">Emoji are welcome. Everyone can see it.</p>
      <input
        aria-label="Username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="mt-4 h-14 w-full rounded-2xl border border-foam/15 bg-tide px-4 text-lg text-foam"
        placeholder="Tidewalker 🌊"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
        }}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-mist">
        <span className="tabular-nums">
          {count}/{NAME_MAX}
        </span>
        {error ? <span className="text-right text-ember">{error}</span> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {PICKS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`Add ${emoji}`}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-foam/10 text-xl"
            onClick={() => {
              if (graphemes(value).length < NAME_MAX) setValue(value + emoji);
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={busy}
        className="mt-4 flex h-14 w-full items-center justify-center rounded-full bg-ember text-lg font-semibold text-ink disabled:opacity-60"
        onClick={() => void submit()}
      >
        {busy ? "Saving" : "Save name"}
      </button>
      <button type="button" className="mt-1 min-h-11 w-full text-sm text-mist" onClick={onGuest}>
        Play without a name
      </button>
    </>
  );
}
