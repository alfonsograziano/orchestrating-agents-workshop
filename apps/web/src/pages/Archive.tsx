import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IdeaCard } from '../components/IdeaCard.tsx';
import { EmptyArchive } from '../components/EmptyArchive.tsx';
import { IdeaDetailModal } from '../components/IdeaDetailModal.tsx';
import { PaperGrain } from '../components/PaperGrain.tsx';
import { useArchivedIdeas } from '../hooks/useArchivedIdeas.ts';

export function Archive() {
  const [openIdeaId, setOpenIdeaId] = useState<string | null>(null);
  const { status, ideas, error, unarchiveIdea, deleteIdea } = useArchivedIdeas();
  const formattedCount = String(ideas.length).padStart(2, '0');
  const ideaWord = ideas.length === 1 ? 'idea' : 'ideas';

  return (
    <main className="relative min-h-screen bg-paper text-ink overflow-x-hidden">
      <PaperGrain />

      <div
        aria-hidden
        className="pointer-events-none absolute top-[-160px] left-[-120px] w-[520px] h-[520px] rounded-full bg-cream/80 blur-[120px]"
      />

      <div className="relative z-10 max-w-[1280px] mx-auto px-xl py-xl">
        <header className="relative mb-2xl">
          <Link
            to="/app"
            className="inline-flex items-center gap-xs text-label-md uppercase tracking-[0.22em] text-ink/55 hover:text-primary transition-colors"
          >
            <span aria-hidden>←</span>
            Back to the garden
          </Link>
          <div className="mt-md flex items-end justify-between gap-md flex-wrap pb-md border-b border-ink/15">
            <div className="flex items-baseline gap-lg flex-wrap">
              <h1 className="font-display italic text-[clamp(40px,5vw,64px)] leading-[0.95] tracking-[-0.015em] text-ink">
                the archive
              </h1>
              <span className="hidden sm:inline-flex items-center gap-xs text-label-md uppercase tracking-[0.22em] text-ink/55">
                <span className="w-7 h-px bg-ink/30" />
                set aside, not lost
              </span>
            </div>
            <span className="hidden md:inline-flex items-baseline gap-xs text-label-md uppercase tracking-[0.22em] text-ink/55">
              <span className="font-display not-italic text-[28px] text-ink/85 leading-none">
                {formattedCount}
              </span>
              {ideaWord}
            </span>
          </div>
        </header>

        {status === 'error' && (
          <div
            role="alert"
            className="relative bg-wilted-soft/70 border border-wilted/30 text-wilted rounded-lg p-lg flex items-start gap-md"
          >
            <span
              aria-hidden
              className="font-display italic text-[28px] leading-none text-wilted/80"
            >
              !
            </span>
            <div className="flex-1">
              <p className="font-display italic text-[18px] text-wilted leading-tight">
                The archive is unreachable.
              </p>
              <p className="text-body-sm text-wilted/80 mt-xs">
                We couldn't load your archive: {error ?? 'Unknown error'}.
              </p>
            </div>
          </div>
        )}

        {(status === 'loading' || status === 'idle') && (
          <p
            className="text-center font-display italic text-[22px] text-ink/55 py-2xl"
            role="status"
            aria-live="polite"
          >
            opening the archive…
          </p>
        )}

        {status === 'ready' &&
          (ideas.length === 0 ? (
            <EmptyArchive />
          ) : (
            <div className="grid gap-grid-gutter grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {ideas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} onOpen={(id) => setOpenIdeaId(id)} />
              ))}
            </div>
          ))}
      </div>

      {/* No watering, edit, or timeline-entry handlers are passed: an archived
          idea's detail view has no way to change anything (spec 004 FR-016). */}
      <IdeaDetailModal
        ideaId={openIdeaId}
        onClose={() => setOpenIdeaId(null)}
        onUnarchiveIdea={unarchiveIdea}
        onDeleteIdea={deleteIdea}
      />
    </main>
  );
}
