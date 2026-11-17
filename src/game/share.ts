const GLASS: [number, number, number][] = [
  [232, 156, 96],
  [214, 112, 102],
  [232, 196, 154],
  [78, 184, 168],
  [64, 142, 176],
  [186, 206, 216],
];

function tint(c: [number, number, number], t: number) {
  const f = (v: number) => Math.round(Math.max(0, Math.min(255, v + (t >= 0 ? (255 - v) * t : v * t))));
  return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
}

export type ShareInput = {
  name: string | null;
  score: number;
  title: string;
  mode: "free" | "daily";
  drops: number;
};

async function paint(input: ShareInput) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  try {
    await document.fonts.load("600 120px Fraunces");
    await document.fonts.load("500 40px Outfit");
  } catch {
    /* fall back to system fonts */
  }

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#1c2c44");
  sky.addColorStop(0.5, "#0e202c");
  sky.addColorStop(1, "#061016");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(840, 220, 10, 840, 220, 260);
  glow.addColorStop(0, "rgba(232,243,238,0.35)");
  glow.addColorStop(1, "rgba(232,243,238,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#e8f3ee";
  ctx.beginPath();
  ctx.arc(840, 220, 46, 0, Math.PI * 2);
  ctx.fill();

  const panes = Math.max(3, Math.min(14, input.drops || 3));
  const cx = W / 2;
  let y = 1000;
  for (let i = 0; i < panes; i++) {
    const w = 250 - i * 7;
    const d = w * 0.5;
    const t = 44;
    const col = GLASS[i % GLASS.length];
    ctx.fillStyle = tint(col, -0.45);
    ctx.beginPath();
    ctx.moveTo(cx + w, y);
    ctx.lineTo(cx, y + d);
    ctx.lineTo(cx, y + d + t);
    ctx.lineTo(cx + w, y + t);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tint(col, 0.1);
    ctx.beginPath();
    ctx.moveTo(cx - w, y);
    ctx.lineTo(cx, y + d);
    ctx.lineTo(cx, y + d + t);
    ctx.lineTo(cx - w, y + t);
    ctx.closePath();
    ctx.fill();
    const top = ctx.createLinearGradient(cx - w, y - d, cx + w, y + d);
    top.addColorStop(0, tint(col, 0.5));
    top.addColorStop(1, tint(col, 0.1));
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.moveTo(cx, y - d);
    ctx.lineTo(cx + w, y);
    ctx.lineTo(cx, y + d);
    ctx.lineTo(cx - w, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
    y -= 52;
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#e8956a";
  ctx.font = "500 40px Outfit, sans-serif";
  ctx.fillText(input.mode === "daily" ? "DAILY TIDE" : "TIDEGLASS", W / 2, 150);
  ctx.fillStyle = "#e8f3ee";
  ctx.font = "600 230px Fraunces, Georgia, serif";
  ctx.fillText(String(input.score), W / 2, 420);
  ctx.font = "600 64px Fraunces, Georgia, serif";
  ctx.fillText(input.title, W / 2, 520);
  ctx.fillStyle = "#93b0a8";
  ctx.font = "500 44px Outfit, sans-serif";
  if (input.name) ctx.fillText(input.name, W / 2, 590);
  ctx.font = "500 36px Outfit, sans-serif";
  ctx.fillText(location.host, W / 2, H - 70);
  return canvas;
}

export async function shareRun(input: ShareInput): Promise<"shared" | "saved" | "failed"> {
  const canvas = await paint(input);
  if (!canvas) return "failed";
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return "failed";
  const file = new File([blob], "tideglass.png", { type: "image/png" });
  const text = `I stacked ${input.score} in Tideglass${input.mode === "daily" ? " (daily tide)" : ""}. Beat that.`;
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text, url: location.origin });
      return "shared";
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "failed";
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "tideglass.png";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  return "saved";
}
