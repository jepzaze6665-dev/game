// Cut-out puppet skeletons for hand-drawn units. A rig (made in tools/rig.html)
// cuts a unit's PNG into these parts; the game rotates them about their pivots
// with the animation functions below. Angles are radians, positive = the part
// swings forward (toward the direction the unit faces); the renderer mirrors
// everything for units facing left.
//
// Each skeleton lists its parts back-to-front. `parent` is the part a pivot is
// attached to (null = the unit's feet anchor). The editor asks the artist to
// draw a polygon and click a pivot for every part.

export const SKELETONS = {
  humanoid: {
    label: 'Humanoid (two legs, two arms)',
    parts: [
      { name: 'legB', label: 'Back leg', parent: null, hint: 'pivot at the hip' },
      { name: 'legF', label: 'Front leg', parent: null, hint: 'pivot at the hip' },
      { name: 'torso', label: 'Torso', parent: null, hint: 'pivot at the hips (centre of the belt)' },
      { name: 'head', label: 'Head', parent: 'torso', hint: 'pivot at the neck' },
      { name: 'armB', label: 'Back arm (+ shield)', parent: 'torso', hint: 'pivot at the shoulder' },
      { name: 'armF', label: 'Front arm (+ weapon)', parent: 'torso', hint: 'pivot at the shoulder' },
    ],
    pose: humanoidPose,
  },
  mount: {
    label: 'Mounted (rider on a four-legged mount)',
    parts: [
      { name: 'legRearB', label: 'Rear leg, far side', parent: null, hint: 'pivot at the hip' },
      { name: 'legFrontB', label: 'Front leg, far side', parent: null, hint: 'pivot at the shoulder' },
      { name: 'body', label: 'Mount body (+ banner / cloth)', parent: null, hint: 'pivot at the centre of the back' },
      { name: 'neck', label: 'Mount head + neck', parent: 'body', hint: 'pivot where the neck meets the body' },
      { name: 'riderTorso', label: 'Rider torso (+ rider leg)', parent: 'body', hint: 'pivot at the saddle' },
      { name: 'riderHead', label: 'Rider head', parent: 'riderTorso', hint: 'pivot at the neck' },
      { name: 'armF', label: 'Rider weapon arm', parent: 'riderTorso', hint: 'pivot at the shoulder' },
      { name: 'legRearF', label: 'Rear leg, near side', parent: null, hint: 'pivot at the hip' },
      { name: 'legFrontF', label: 'Front leg, near side', parent: null, hint: 'pivot at the shoulder' },
    ],
    pose: mountPose,
  },
};

function mountPose(a) {
  const A = { legRearB: 0, legFrontB: 0, body: 0, neck: 0, riderTorso: 0, riderHead: 0, armF: 0, legRearF: 0, legFrontF: 0 };
  let dx = 0, dy = 0, sx = 1, sy = 1;
  const style = a.style || 'melee';
  if (a.state === 'attack' || a.anim === 'atk') {
    if (a.phase === 'windup') {
      const k = ease(Math.min(1, a.phaseT / Math.max(0.05, a.windup)));
      if (style === 'thrust') { A.armF = -0.35 * k; A.riderTorso = -0.12 * k; A.body = -0.05 * k; A.neck = 0.08 * k; dx = -0.08 * k; }
      else { A.armF = -2.0 * k; A.riderTorso = -0.15 * k; A.riderHead = 0.08 * k; }
    } else {
      const s = Math.max(0, 1 - a.phaseT / Math.max(0.05, a.recover));
      const snap = s > 0.7 ? 1 : s / 0.7;
      if (style === 'thrust') { A.armF = 0.3 * snap; A.riderTorso = 0.15 * snap; A.body = 0.04 * snap; A.neck = -0.1 * snap; A.legFrontF = 0.35 * snap; A.legFrontB = -0.2 * snap; dx = 0.32 * snap; }
      else { A.armF = 0.8 * snap; A.riderTorso = 0.2 * snap; A.riderHead = -0.1 * snap; dx = 0.18 * snap; }
    }
  } else if (a.anim === 'walk') {
    const ph = a.animT * (4 + a.speed * 1.2) * Math.PI, s = Math.sin(ph), c = Math.cos(ph);
    A.legFrontF = 0.55 * s; A.legRearB = 0.45 * s;          // diagonal pairs move together (trot)
    A.legFrontB = -0.55 * s; A.legRearF = -0.45 * s;
    A.body = 0.04 * c; A.neck = -0.12 * c; A.riderTorso = 0.06 * c; A.riderHead = -0.04 * c; A.armF = 0.05 * s;
    dy = Math.abs(c) * 0.07;
  } else {
    const ph = a.time * 1.6 + a.seed;
    A.neck = Math.sin(ph) * 0.04; A.riderTorso = Math.sin(ph + 1) * 0.02; A.body = Math.sin(ph) * 0.01;
  }
  if (a.hit) { A.riderTorso -= 0.15; A.neck += 0.15; dx -= 0.05; }
  return { angles: A, dx, dy, sx, sy };
}

// How a unit's weapon is used; picked from the roster's `look.weapon`.
export function attackStyle(weapon) {
  if (weapon === 'bow') return 'bow';
  if (['halberd', 'lavaspear', 'chainhook', 'lance'].includes(weapon)) return 'thrust';
  if (['crossbow', 'laser', 'rail', 'pods', 'flamer', 'tesla'].includes(weapon)) return 'gun';
  if (['staff', 'crook'].includes(weapon)) return 'cast';
  return 'melee';
}

// Returns { angles: {part: rad}, dx, dy, sx, sy } for a unit's current state.
// `a` is the animation input: { anim, state, phase, phaseT, windup, recover, animT, speed, time, seed, hit, style }.
function humanoidPose(a) {
  const A = { legB: 0, legF: 0, torso: 0, head: 0, armB: 0, armF: 0 };
  let dx = 0, dy = 0, sx = 1, sy = 1;
  if (a.state === 'attack' || a.anim === 'atk') {
    const style = a.style || 'melee';
    if (a.phase === 'windup') {
      const k = ease(Math.min(1, a.phaseT / Math.max(0.05, a.windup)));
      if (style === 'bow') {           // raise the bow forward, draw the string hand back
        A.armF = 0.55 * k; A.armB = -0.8 * k; A.torso = -0.1 * k; A.head = 0.08 * k; A.legF = -0.1 * k; A.legB = 0.1 * k;
      } else if (style === 'gun') {    // shoulder the weapon and aim
        A.armF = 0.85 * k; A.armB = 0.7 * k; A.torso = -0.05 * k; A.head = 0.04 * k;
      } else if (style === 'cast') {   // staff overhead, lean back
        A.armF = -1.7 * k; A.armB = 0.3 * k; A.torso = -0.15 * k; A.head = 0.12 * k; dx = -0.05 * k;
      } else if (style === 'thrust') { // pull the spear back, coil the body
        A.armF = -0.55 * k; A.armB = 0.2 * k; A.torso = -0.12 * k; A.head = 0.06 * k; A.legF = -0.12 * k; A.legB = 0.12 * k; dx = -0.1 * k;
      } else {                         // raise the weapon up and back
        A.armF = -2.4 * k; A.torso = -0.18 * k; A.head = 0.1 * k; A.armB = 0.25 * k;
        A.legF = -0.15 * k; A.legB = 0.15 * k; dx = -0.06 * k;
      }
    } else {
      const s = Math.max(0, 1 - a.phaseT / Math.max(0.05, a.recover));      // 1 at impact -> 0 recovered
      const snap = s > 0.7 ? 1 : s / 0.7;                                     // hold the impact pose briefly
      if (style === 'bow') {           // release: string hand flicks forward, bow lowers as he recovers
        A.armF = 0.55 * s; A.armB = 0.3 * snap; A.torso = -0.1 * s + 0.08 * snap; dx = -0.04 * snap;
      } else if (style === 'gun') {    // recoil while holding the aim
        A.armF = 0.85 * s + 0.2 * snap; A.armB = 0.7 * s; A.torso = -0.05 * s - 0.12 * snap; A.head = -0.06 * snap; dx = -0.14 * snap;
      } else if (style === 'cast') {   // thrust the staff forward
        A.armF = 0.7 * snap; A.armB = -0.2 * snap; A.torso = 0.18 * snap; A.head = -0.08 * snap; dx = 0.15 * snap;
      } else if (style === 'thrust') { // jab forward with a long lunge
        A.armF = 0.45 * snap; A.armB = -0.15 * snap; A.torso = 0.16 * snap; A.head = -0.06 * snap; A.legF = 0.4 * snap; A.legB = -0.3 * snap; dx = 0.38 * snap;
      } else {                         // swung down and forward past the rest pose
        A.armF = 0.9 * snap; A.torso = 0.22 * snap; A.head = -0.12 * snap; A.armB = -0.2 * snap;
        A.legF = 0.35 * snap; A.legB = -0.3 * snap; dx = 0.22 * snap; sy = 1 - 0.04 * snap;
      }
    }
  } else if (a.anim === 'walk') {
    const ph = a.animT * (4.5 + a.speed * 1.4) * Math.PI;
    const s = Math.sin(ph);
    A.legF = 0.45 * s; A.legB = -0.45 * s;
    A.armF = -0.35 * s; A.armB = 0.3 * s;
    A.torso = 0.04 * s; A.head = -0.03 * s;
    dy = Math.abs(Math.cos(ph)) * 0.05;
  } else {
    const ph = a.time * 2.0 + a.seed;
    A.torso = Math.sin(ph) * 0.015; A.head = Math.sin(ph + 0.6) * 0.02;
    A.armF = Math.sin(ph) * 0.03; A.armB = -Math.sin(ph) * 0.02;
    sy = 1 + Math.sin(ph) * 0.01;
  }
  if (a.hit) { A.torso -= 0.2; A.head -= 0.25; A.armF += 0.2; dx -= 0.05; }
  return { angles: A, dx, dy, sx, sy };
}

function ease(t) { return t * t * (3 - 2 * t); }
