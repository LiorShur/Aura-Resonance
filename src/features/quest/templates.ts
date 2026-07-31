import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { firebase } from '@/lib/firebase';
import type { FractureType } from '@/features/map/types';

export type Verification = 'photo' | 'breathing' | 'session_code';

export interface QuestTemplate {
  type: FractureType;
  title: string;
  prompt: string;
  verification: Verification;
  rpReward: number;
}

// Bundled fallbacks so the sheet has a prompt at a desk before questTemplates are
// seeded. The authoritative copies live in Firestore (scripts/data). Kept to the
// templateIds the sample Fractures reference, plus a per-type default.
const BUNDLED: Record<string, QuestTemplate> = {
  'litter-01': { type: 'kindness', title: 'Clear a corner', prompt: 'Pick up three pieces of litter here and bin them. Snap a photo of the tidied spot.', verification: 'photo', rpReward: 30 },
  'greet-01': { type: 'kindness', title: 'A genuine hello', prompt: 'Greet someone nearby with a real hello or a nod. Then photograph the place (no faces needed).', verification: 'photo', rpReward: 25 },
  'echo-01': { type: 'kindness', title: 'Encouragement here', prompt: 'Leave an Echo with one encouraging line for whoever passes this spot next.', verification: 'photo', rpReward: 20 },
  'breathe-01': { type: 'high_tension', title: 'Steady the shatter', prompt: 'This Fracture is unstable. Breathe with the pacer until the pattern settles, then solve it.', verification: 'breathing', rpReward: 40 },
  'breathe-02': { type: 'high_tension', title: 'Before you react', prompt: 'Take a full breathing cycle before moving on. Let the puzzle come back together.', verification: 'breathing', rpReward: 40 },
  'coop-01': { type: 'coop', title: 'Two to mend', prompt: 'This Fracture needs two Weavers. Meet a partner here, share the code, and solve it together.', verification: 'session_code', rpReward: 50 },
};

const DEFAULTS: Record<FractureType, QuestTemplate> = {
  kindness: { type: 'kindness', title: 'A small kindness', prompt: 'Perform one small, real act of kindness at this spot.', verification: 'photo', rpReward: 25 },
  high_tension: { type: 'high_tension', title: 'Breathe to stabilise', prompt: 'Breathe with the pacer until the Fracture settles.', verification: 'breathing', rpReward: 40 },
  coop: { type: 'coop', title: 'Mend together', prompt: 'Pair up with another Weaver here to mend this Fracture.', verification: 'session_code', rpReward: 50 },
};

export function bundledTemplate(id: string, type: FractureType): QuestTemplate {
  return BUNDLED[id] ?? DEFAULTS[type];
}

/**
 * Resolve a Fracture's quest template: Firestore first (seeded content), then the
 * bundled fallback so the sheet always has something to show in sim.
 */
export function useTemplate(templateId: string, type: FractureType): QuestTemplate {
  const [template, setTemplate] = useState<QuestTemplate>(() => bundledTemplate(templateId, type));

  useEffect(() => {
    let cancelled = false;
    setTemplate(bundledTemplate(templateId, type));
    getDoc(doc(firebase().db, 'questTemplates', templateId))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const d = snap.data();
        setTemplate({
          type: (d.type as FractureType) ?? type,
          title: String(d.title ?? ''),
          prompt: String(d.prompt ?? ''),
          verification: (d.verification as Verification) ?? 'photo',
          rpReward: Number(d.rpReward ?? 0),
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [templateId, type]);

  return template;
}
