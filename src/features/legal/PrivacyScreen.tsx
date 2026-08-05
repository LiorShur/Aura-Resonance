/**
 * Plain-language privacy policy (SAFETY §6 / M10 "privacy policy live and
 * linked"). Public — reachable at #privacy before sign-in. Keep this in sync with
 * docs/PRIVACY.md. This is a pilot policy for ~25 players in one neighbourhood;
 * it says what is collected and why, in language a person can actually read.
 */
export function PrivacyScreen() {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col overflow-y-auto p-6">
      <a href="#/" className="text-sm text-aura-cyan underline-offset-2 hover:underline">
        ← Back
      </a>
      <h1 className="mt-3 font-display text-3xl text-slate-100">Privacy — Aura Resonance pilot</h1>
      <p className="mt-1 text-xs text-slate-500">A small closed pilot. Last updated at launch.</p>

      <div className="mt-6 space-y-5 text-sm leading-relaxed text-slate-300">
        <Section title="Who this is for">
          Aura Resonance is a research pilot for a small, invited group. You must be 16 or older
          to take part.
        </Section>

        <Section title="What we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>Your email (for sign-in) and a display name and avatar you choose.</li>
            <li>Your age confirmation (that you are 16+), stored as a yes/no with a date — not
              your birth date.</li>
            <li>Your location <strong>only at the moment you tap “I’m here”</strong> to verify a
              quest, or when you leave an Echo. We never track you in the background.</li>
            <li>Content you create: quest photos, Echoes, dilemmas and advice, and ratings.</li>
            <li>Basic activity events (e.g. opening the app, completing a quest) so we can tell
              whether the game works.</li>
          </ul>
        </Section>

        <Section title="What we do NOT collect">
          No background or continuous location. No health, heart-rate, or fitness data. No
          contacts, no advertising identifiers, no third-party trackers.
        </Section>

        <Section title="Photos">
          Quest photos are screened and <strong>any faces are automatically blurred before the
          photo is stored</strong>. The original, unblurred photo is never kept.
        </Section>

        <Section title="How your content is handled">
          Dilemmas and advice are shown to a few other players to help you, and are anonymous
          between author and adviser. Echoes are visible to people near where you left them.
          Everything is checked by an automated safety filter before it becomes visible; if
          something suggests you’re in crisis, we show you support resources instead of sharing
          it.
        </Section>

        <Section title="How long we keep it">
          <ul className="list-disc space-y-1 pl-5">
            <li>Precise check-in coordinates are kept for 30 days, then blurred to about 1km for
              aggregate map statistics.</li>
            <li>Dilemmas and advice are deleted 90 days after they close.</li>
            <li>Echoes expire after 30 days.</li>
          </ul>
        </Section>

        <Section title="Deleting your account">
          You can delete your account yourself at any time from your Profile → Danger zone. It
          removes your account, your content, and your location records. It’s immediate and can’t
          be undone — no email request needed.
        </Section>

        <Section title="Contact">
          Questions about your data during the pilot? Contact the pilot organiser at the address
          you were invited from.
        </Section>
      </div>

      <div className="h-8" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 font-medium text-slate-100">{title}</h2>
      {children}
    </section>
  );
}
