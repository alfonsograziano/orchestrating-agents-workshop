import { Link } from 'react-router-dom';

export function EmptyArchive() {
  return (
    <section
      aria-label="Empty archive"
      className="relative flex flex-col items-center justify-center text-center py-2xl px-md gap-md min-h-[420px]"
    >
      <div className="relative w-40 h-40 flex items-center justify-center">
        <div aria-hidden className="absolute inset-0 rounded-full bg-cream blur-[30px]" />
        <img
          src="/plants/oak/stage-01.png"
          alt=""
          width={140}
          height={140}
          className="relative w-32 h-32 object-contain opacity-40 grayscale"
          draggable={false}
        />
      </div>

      <span className="inline-flex items-center gap-xs text-label-md uppercase tracking-[0.22em] text-ink/55">
        <span className="w-6 h-px bg-ink/30" />
        nothing set aside
      </span>

      <h2 className="font-display italic text-[clamp(30px,4vw,44px)] leading-[1.05] tracking-[-0.01em] text-ink max-w-xl">
        Your archive is empty.
      </h2>

      <p className="text-[15px] leading-[1.7] text-ink/65 max-w-md">
        Ideas you archive will rest here — frozen at the level they reached, with every
        watering still on record. You can bring any of them back whenever you like.
      </p>

      <Link
        to="/app"
        className="mt-md group inline-flex items-center gap-sm bg-ink text-paper text-label-md rounded-full pl-md pr-xs py-[6px] hover:bg-primary transition-colors"
      >
        <span>Back to the garden</span>
        <span
          aria-hidden="true"
          className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-[14px] transition-transform group-hover:translate-x-[2px]"
        >
          →
        </span>
      </Link>
    </section>
  );
}
