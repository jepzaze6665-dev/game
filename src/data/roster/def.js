// Shared defaults for unit definitions so each roster file stays readable.
const RADIUS = { small: 0.34, humanoid: 0.42, big: 0.55, quad: 0.5, bug: 0.3, flyer: 0.36, vehicle: 0.9, mech: 0.6, mount: 0.6, giant: 1.0 };
const MASS = { small: 0.6, humanoid: 1, big: 2.5, quad: 1.2, bug: 0.4, flyer: 0.5, vehicle: 6, mech: 2.5, mount: 2.4, giant: 8 };

export function unit(d) {
  const body = (d.look && d.look.body) || 'humanoid';
  const cycle = 1 / (d.attackSpeed || 1);
  return {
    targetType: 'ground', damageType: 'physical', armor: 0, bonus: 1.5,
    counterTags: [], strongAgainst: [], weakAgainst: [], ability: null, passive: null,
    cooldown: Math.min(8, 2.5 + d.cost / 50), unlockRequirement: null, squad: 1,
    radius: RADIUS[body], mass: MASS[body],
    windup: Math.min(0.55, cycle * 0.3), recover: Math.min(0.5, cycle * 0.3),
    ...d,
  };
}
