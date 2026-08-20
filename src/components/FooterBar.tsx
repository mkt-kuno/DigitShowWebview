export function FooterBar({
  heartbeat,
  responseTimeMs,
}: {
  heartbeat: { running: boolean; info: string } | null;
  responseTimeMs: number | null;
}) {
  return (
    <>
      <div aria-hidden className="h-6 md:h-8" />
      <div className="fixed bottom-0 left-0 right-0 z-20 flex h-6 items-center gap-2 border-t border-slate-200 bg-slate-50/70 px-2 text-[0.65rem] backdrop-blur dark:border-slate-800 dark:bg-slate-950/70 md:h-8 md:gap-3 md:px-3 md:text-xs">
        <span className="flex min-w-0 shrink-0 items-center gap-1">
          <span
            aria-label={heartbeat?.running ? 'Heartbeat running' : 'Heartbeat stopped'}
            className={heartbeat?.running ? 'heart-pulse' : undefined}
          >
            {heartbeat?.running ? '💗' : '🤍'}
          </span>
          <span
            translate="no"
            className="hidden truncate text-slate-600 dark:text-slate-400 sm:inline"
          >
            {heartbeat?.info ?? '—'}
          </span>
        </span>
        <span className="flex-1" />
        <span translate="no" className="shrink-0 tabular-nums text-slate-500 dark:text-slate-500">
          Response: {responseTimeMs != null ? responseTimeMs.toFixed(1) : '—'}[ms]
        </span>
      </div>
    </>
  );
}
