import { cn } from "@/lib/utils";

const STROKES = 12;

/**
 * Loading, the Conecta's way (`Carregando`): 12 strokes in a ring, lit one
 * after the other in grey (the `traco-carregando` keyframes of index.css),
 * and "Carregando" under them. The phone uses it where the PC shows
 * skeletons (see `LoadingSwap`); a saving button keeps its spinner.
 *
 * `compact` (28 px, `py-10`): inside a card or a block of the page. Without
 * it (40 px): the page's whole content area, centred.
 */
export function Carregando({ label = "Carregando", compact = false, className }: { label?: string; compact?: boolean; className?: string }) {
  const size = compact ? 28 : 40;
  const width = compact ? 2.5 : 3;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center gap-3", compact ? "py-10" : "min-h-[calc(100dvh-16rem)] py-10", className)}
    >
      <span className="relative block" style={{ width: size, height: size }} aria-hidden>
        {Array.from({ length: STROKES }, (_, i) => (
          <span
            key={i}
            className="absolute top-0 left-1/2 rounded-full bg-foreground [animation:traco-carregando_1s_linear_infinite] motion-reduce:[animation:none]"
            style={{
              width,
              height: size * 0.28,
              marginLeft: -width / 2,
              transform: `rotate(${i * (360 / STROKES)}deg)`,
              transformOrigin: `center ${size / 2}px`,
              // A negative delay starts each stroke at its own point of the cycle: the trail that turns.
              animationDelay: `${(i - STROKES) / STROKES}s`,
            }}
          />
        ))}
      </span>
      <p className="text-xs font-medium tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
