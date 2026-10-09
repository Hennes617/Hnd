import { ArrowUpRight, ChevronRight } from "lucide-react";
import type { Reservoir } from "@hnd/shared";
import type { Selection } from "../WaterMap";
export function ReservoirArt({ variant = 0 }: { variant?: number }) {
  return (
    <svg
      className={`reservoir-art art-${variant}`}
      viewBox="0 0 420 160"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect
        width="420"
        height="160"
        fill={variant === 1 ? "#d7dfcd" : variant === 2 ? "#e0e4d7" : "#dce4d3"}
      />
      <path
        d="M-20 83Q50-5 148 47T311 19T450 30V170H-20Z"
        fill={variant === 1 ? "#bcc7ae" : "#c0d0b4"}
      />
      <path
        d="M-20 130Q20 40 105 72T214 68T351 72T450 31V170H-20Z"
        fill={variant === 1 ? "#9fac91" : "#a4bc9b"}
      />
      <path
        d="M-10 172L118 100Q136 87 168 103L208 81Q225 72 243 85L276 96L308 71L356 66L323 87L311 117L257 126L228 159Z"
        fill={variant === 2 ? "#719da1" : "#7aa5a5"}
      />
      <path
        d="M-10 165L116 102Q137 92 168 105L209 84Q225 76 244 87L276 98L309 74"
        fill="none"
        stroke="#bbd4cc"
        strokeWidth="3"
      />
      <path d="M-10 170L83 128L127 149L188 136L228 160Z" fill="#66856e" />
      <path
        d="M264 148L281 125L327 119L354 89L392 98L439 75V170H264Z"
        fill="#708e70"
      />
      <path
        d="M-15 121Q61 24 154 66T288 47T441 58M-15 112Q59 15 158 58T288 38T441 49"
        fill="none"
        stroke="#eef2e5"
        strokeWidth=".7"
        opacity=".7"
      />
      <path d="M279 122L291 125L316 95L309 93Z" fill="#e5e8db" />
      <path d="M288 124L291 125L316 95L313 94Z" fill="#bdc7b8" />
    </svg>
  );
}

export function ReservoirCards({
  reservoirs,
  onSelect,
  limit,
}: {
  reservoirs: Reservoir[];
  onSelect: (selection: Selection) => void;
  limit?: number;
}) {
  return (
    <div className="reservoir-grid">
      {reservoirs.slice(0, limit).map((r, i) => (
        <button
          className="reservoir-card"
          key={r.id}
          onClick={() => onSelect({ type: "reservoir", id: r.id })}
        >
          <div className="reservoir-image">
            <ReservoirArt variant={i % 3} />
            <span className="image-tag">
              {r.type === "pre-dam" ? "Vorsperre" : "Talsperre"}
            </span>
            <span className="card-explore">
              <ArrowUpRight size={17} />
            </span>
          </div>
          <div className="reservoir-card-content">
            <span className="card-eyebrow">{r.region.join(" · ")}</span>
            <h3>{r.name}</h3>
            <p>{r.operator}</p>
            <div className="reservoir-card-footer">
              <span>
                <i />
                Füllstand nicht angebunden
              </span>
              <ChevronRight size={16} />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
