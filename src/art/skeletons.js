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
};

// Returns { angles: {part: rad}, dx, dy, sx, sy } for a unit's current state.
// `a` is the animation input: { anim, state, phase, phaseT, windup, recover, animT, speed, time, seed, hit }.
function humanoidPose(a) {
  const A = { legB: 0, legF: 0, torso: 0, head: 0, armB: 0, armF: 0 };
  let dx = 0, dy = 0, sx = 1, sy = 1;
  if (a.state === 'attack' || a.anim === 'atk') {
    if (a.phase === 'windup') {
      const k = ease(Math.min(1, a.phaseT / Math.max(0.05, a.windup)));
      A.armF = -2.4 * k;           // raise the weapon up and back
      A.torso = -0.18 * k; A.head = 0.1 * k; A.armB = 0.25 * k;
      A.legF = -0.15 * k; A.legB = 0.15 * k;
      dx = -0.06 * k;
    } else {
      const s = Math.max(0, 1 - a.phaseT / Math.max(0.05, a.recover));      // 1 at impact -> 0 recovered
      const snap = s > 0.7 ? 1 : s / 0.7;                                     // hold the impact pose briefly
      A.armF = 0.9 * snap;         // swung down and forward past the rest pose
      A.torso = 0.22 * snap; A.head = -0.12 * snap; A.armB = -0.2 * snap;
      A.legF = 0.35 * snap; A.legB = -0.3 * snap;
      dx = 0.22 * snap; sy = 1 - 0.04 * snap;
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
