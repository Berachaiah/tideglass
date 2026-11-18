import { useId } from "react";

export type RewardArtKind = "keys" | "boost" | "palette";

/**
 * Reward icons drawn as little objects rather than glyphs: a gold key, an
 * extruded bolt and a faceted gem. Each one has its own shadow, rim light and
 * highlight so it reads as a physical item on the calendar shelf.
 */
export function RewardArt({
  kind,
  color,
  className,
}: {
  kind: RewardArtKind;
  color?: string;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gold = `gold-${id}`;
  const goldDark = `goldDark-${id}`;
  const shadow = `shadow-${id}`;
  const bolt = `bolt-${id}`;
  const boltDark = `boltDark-${id}`;
  const gem = `gem-${id}`;

  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={shadow} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#02080c" stopOpacity="0.5" />
          <stop offset="1" stopColor="#02080c" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={gold} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#fff3dd" />
          <stop offset="0.35" stopColor="#ffc48f" />
          <stop offset="0.72" stopColor="#e8915f" />
          <stop offset="1" stopColor="#a8512f" />
        </linearGradient>
        <linearGradient id={goldDark} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0a271" />
          <stop offset="1" stopColor="#8e4327" />
        </linearGradient>
        <linearGradient id={bolt} x1="0.1" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#fff0d2" />
          <stop offset="0.4" stopColor="#ffb884" />
          <stop offset="1" stopColor="#d4734a" />
        </linearGradient>
        <linearGradient id={boltDark} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9603c" />
          <stop offset="1" stopColor="#7d3b22" />
        </linearGradient>
        <linearGradient id={gem} x1="0.15" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.38" stopColor={color ?? "#8fd3c4"} />
          <stop offset="1" stopColor="#07161c" stopOpacity="0.92" />
        </linearGradient>
      </defs>

      {kind === "keys" ? (
        <g>
          <ellipse cx="20" cy="34.5" rx="12" ry="3.6" fill={`url(#${shadow})`} />
          <path
            d="M12.6 10.4a8 8 0 1 0 0 14.2"
            fill="none"
            stroke={`url(#${gold})`}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M12.6 11.6a6.8 6.8 0 1 0 0 11.8"
            fill="none"
            stroke="#fffaef"
            strokeOpacity="0.45"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <rect x="18" y="14.9" width="16" height="4.9" rx="2.4" fill={`url(#${gold})`} />
          <rect x="18" y="15.6" width="15" height="1.3" rx="0.65" fill="#fffaf0" fillOpacity="0.6" />
          <rect x="28.4" y="19.2" width="3.6" height="6.4" rx="1.6" fill={`url(#${goldDark})`} />
          <rect x="32.9" y="19.2" width="3.4" height="4.2" rx="1.5" fill={`url(#${goldDark})`} />
          <ellipse
            cx="9.2"
            cy="13.4"
            rx="2.6"
            ry="1.6"
            fill="#ffffff"
            fillOpacity="0.75"
            transform="rotate(-38 9.2 13.4)"
          />
        </g>
      ) : null}

      {kind === "boost" ? (
        <g>
          <ellipse cx="20" cy="35" rx="11" ry="3.2" fill={`url(#${shadow})`} />
          <path d="M23.4 5.5 11 23.2h6.6l-1.6 12.4 13-18.6h-6.9z" fill={`url(#${boltDark})`} transform="translate(0.8 1.8)" />
          <path
            d="M23.4 4.6 11 22.3h6.6l-1.6 12.4 13-18.6h-6.9z"
            fill={`url(#${bolt})`}
            stroke="#fff6e6"
            strokeOpacity="0.55"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          <path d="M21.6 8.4 15.4 18h4.1l-1 6.2 5.4-8.4h-3.6z" fill="#fffdf7" fillOpacity="0.4" />
          <circle cx="31.4" cy="10.6" r="1.7" fill="#ffe3c6" fillOpacity="0.9" />
          <circle cx="9.6" cy="27" r="1.1" fill="#ffe3c6" fillOpacity="0.65" />
        </g>
      ) : null}

      {kind === "palette" ? (
        <g>
          <ellipse cx="20" cy="35.4" rx="11.5" ry="3.4" fill={`url(#${shadow})`} />
          <path d="M20 4.6 33 16.6 20 35.4 7 16.6z" fill={`url(#${gem})`} />
          <path d="M20 4.6 26.6 16.6 20 35.4z" fill="#ffffff" fillOpacity="0.18" />
          <path d="M20 4.6 13.4 16.6 20 35.4z" fill="#04101a" fillOpacity="0.18" />
          <path d="M7 16.6h26" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.9" />
          <path d="M13.4 16.6 20 4.6l2.2 12z" fill="#ffffff" fillOpacity="0.45" />
          <path
            d="M20 4.6 33 16.6 20 35.4 7 16.6z"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.55"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
        </g>
      ) : null}
    </svg>
  );
}
