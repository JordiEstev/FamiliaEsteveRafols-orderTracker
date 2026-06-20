import { useId } from "react";

const C = {
  pressec_groc:     { type: "pressec",  g: ["#f8c84e", "#e2851c"], crease: "#c9871f" },
  pressec_vermell:  { type: "pressec",  g: ["#ef6f63", "#c1352c"], crease: "#ad382f" },
  pressec_barrejat: { type: "barrejat" },
  albercoc:         { type: "albercoc" },
  cirera:           { type: "cirera",   g: ["#e6627c", "#9a1c32"] },
  melo:             { type: "melo",     g: ["#ece08f", "#b49a3e"] },
  sindria:          { type: "sindria",  g: ["#62c574", "#266a36"] },
};

const PEACH =
  "M50 31 C46 23 38 21 33 25 C25 19 15 26 15 45 C15 67 30 88 50 88 " +
  "C70 88 85 67 85 45 C85 26 75 19 67 25 C62 21 54 23 50 31 Z";

// Albercoc: oval vertical amb el solc lateral que forma el gallò
const APRICOT =
  "M52 16 C34 16 22 34 22 55 C22 78 35 90 52 90 C71 90 82 73 82 53 C82 33 70 16 52 16 Z";

const STEM = <path d="M50 30 L50 22" stroke="#7a4a2b" strokeWidth="2.6" strokeLinecap="round" />;
const LEAF = <path d="M52 27 C59 16 73 14 78 18 C72 28 60 31 52 27 Z" fill="#5aa861" />;

function VGrad({ id, from, to }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={from} />
      <stop offset="100%" stopColor={to} />
    </linearGradient>
  );
}

function FruitIcon({ fruit, size = 28, className = "" }) {
  const uid = useId();
  const cfg = C[fruit] || C.melo;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-hidden="true">
      {cfg.type === "pressec" && (
        <>
          <defs><VGrad id={uid} from={cfg.g[0]} to={cfg.g[1]} /></defs>
          <path d={PEACH} fill={`url(#${uid})`} />
          <path d="M50 33 C46 49 46 68 50 85" fill="none" stroke={cfg.crease} strokeWidth="2.4" strokeLinecap="round" opacity="0.5" />
          {STEM}{LEAF}
        </>
      )}

      {cfg.type === "barrejat" && (
        <>
          <defs>
            <clipPath id={`${uid}c`}><path d={PEACH} /></clipPath>
            <VGrad id={`${uid}y`} from="#f8c84e" to="#e2851c" />
            <VGrad id={`${uid}r`} from="#ef6f63" to="#c1352c" />
          </defs>
          {/* el color es parteix seguint el solc, no amb un tall recte */}
          <g clipPath={`url(#${uid}c)`}>
            <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}y)`} />
            <path d="M50 31 C45 48 45 70 50 88 L100 100 L100 0 Z" fill={`url(#${uid}r)`} />
          </g>
          <path d="M50 31 C45 48 45 70 50 88" fill="none" stroke="#9a5a36" strokeWidth="2.2" strokeLinecap="round" opacity="0.4" />
          {STEM}{LEAF}
        </>
      )}

      {cfg.type === "albercoc" && (
        <>
          <defs>
            <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ee7d33" />
              <stop offset="45%" stopColor="#f3a63e" />
              <stop offset="100%" stopColor="#fadf6a" />
            </linearGradient>
          </defs>
          <path d={APRICOT} fill={`url(#${uid})`} />
          <path d="M52 19 C40 30 37 56 45 87" fill="none" stroke="#b9622a" strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />
          <path d="M30 40 C24 50 24 64 30 74" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.16" />
          <path d="M52 18 C52 12 55 7 59 5" fill="none" stroke="#5f9a3a" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M59 5 C61 4 63 5 63 7" fill="none" stroke="#7a4a2b" strokeWidth="3" strokeLinecap="round" />
        </>
      )}

      {cfg.type === "cirera" && (
        <>
          <defs><VGrad id={uid} from={cfg.g[0]} to={cfg.g[1]} /></defs>
          <path d="M40 52 C42 38 50 28 58 22" fill="none" stroke="#7a4a2b" strokeWidth="3" strokeLinecap="round" />
          <path d="M66 54 C66 40 62 30 58 22" fill="none" stroke="#7a4a2b" strokeWidth="3" strokeLinecap="round" />
          <path d="M58 22 C66 11 83 11 88 16 C81 27 66 29 58 22 Z" fill="#5aa861" />
          <circle cx="38" cy="66" r="18" fill={`url(#${uid})`} />
          <circle cx="68" cy="68" r="16" fill={`url(#${uid})`} />
        </>
      )}

      {cfg.type === "melo" && (
        <>
          <defs><VGrad id={uid} from={cfg.g[0]} to={cfg.g[1]} /></defs>
          <ellipse cx="50" cy="57" rx="37" ry="30" fill={`url(#${uid})`} />
          <g stroke="#ab9446" strokeWidth="1.6" fill="none" opacity="0.65">
            <path d="M16 50 Q50 64 84 50" />
            <path d="M19 67 Q50 79 81 67" />
            <path d="M50 27 Q60 57 50 87" />
            <path d="M34 30 Q40 57 34 84" />
            <path d="M66 30 Q60 57 66 84" />
          </g>
          <path d="M50 28 C54 22 60 21 64 23" fill="none" stroke="#5aa861" strokeWidth="3" strokeLinecap="round" />
        </>
      )}

      {cfg.type === "sindria" && (
        <>
          <defs><VGrad id={uid} from={cfg.g[0]} to={cfg.g[1]} /></defs>
          <circle cx="50" cy="55" r="34" fill={`url(#${uid})`} />
          <g stroke="#2c6e3a" strokeWidth="4" fill="none" opacity="0.8">
            <path d="M30 26 Q42 55 30 84" />
            <path d="M42 22 Q50 55 42 88" />
            <path d="M58 22 Q50 55 58 88" />
            <path d="M70 26 Q58 55 70 84" />
          </g>
          <path d="M50 23 C54 17 60 16 64 18" fill="none" stroke="#5aa861" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export default FruitIcon;
