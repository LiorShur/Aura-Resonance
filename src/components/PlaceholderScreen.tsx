interface PlaceholderScreenProps {
  title: string;
  /** The milestone in docs/TASKS.md that fills this screen in. */
  milestone: string;
}

export function PlaceholderScreen({ title, milestone }: PlaceholderScreenProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="font-display text-3xl tracking-wide text-slate-200">{title}</h1>
      <p className="text-sm text-slate-500">Arrives in {milestone}.</p>
    </div>
  );
}
