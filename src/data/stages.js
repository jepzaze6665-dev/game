// Campaign: four chapters, one per enemy race. The player picks their own race
// before every stage. Early stages restrict the enemy to lower unit tiers.
export const CHAPTERS = [
  { id: 1, name: 'Hellgate', enemyRace: 'demon', blurb: 'The Legion of Hell pours through the gate. Hold the valley.' },
  { id: 2, name: 'Tomb Sands', enemyRace: 'mummy', blurb: 'The dead march out of the dunes and they do not stay dead.' },
  { id: 3, name: 'Iron Front', enemyRace: 'robot', blurb: 'The Iron Dominion rolls in with armour and artillery.' },
  { id: 4, name: 'Broken Crown', enemyRace: 'human', blurb: 'A rival kingdom marches under a stolen banner.' },
];

export const STAGES = [
  { id: 1, chapter: 1, name: 'First Blood',   theme: 'volcanic', difficulty: 'easy',   enemyRace: 'demon', enemyTiers: 5,  tip: 'Imps are cheap and fragile. Any melee squad chews through them.' },
  { id: 2, chapter: 1, name: 'Hounds Loose',  theme: 'volcanic', difficulty: 'easy',   enemyRace: 'demon', enemyTiers: 8,  tip: 'Hellhounds dive your ranged line. Keep melee bodies beside your archers.' },
  { id: 3, chapter: 1, name: 'The Overlord',  theme: 'volcanic', difficulty: 'normal', enemyRace: 'demon', enemyTiers: 12, tip: 'Demons are all damage and no armour. Trade cheaply and punish with area attacks.' },
  { id: 4, chapter: 2, name: 'Scarab Tide',   theme: 'desert',   difficulty: 'normal', enemyRace: 'mummy', enemyTiers: 5,  tip: 'Swarms melt to splash damage and fire.' },
  { id: 5, chapter: 2, name: 'Sand Golems',   theme: 'desert',   difficulty: 'normal', enemyRace: 'mummy', enemyTiers: 9,  tip: 'Golems regenerate. Burst them down with anti-heavy units, do not chip.' },
  { id: 6, chapter: 2, name: 'The Pharaoh',   theme: 'desert',   difficulty: 'hard',   enemyRace: 'mummy', enemyTiers: 12, tip: 'The Pharaoh raises the dead. Kill him first with fast hunters or snipers.' },
  { id: 7, chapter: 3, name: 'Drone Storm',   theme: 'snow',     difficulty: 'hard',   enemyRace: 'robot', enemyTiers: 5,  tip: 'Machines have armour: physical arrows bounce. Bring magic, fire or armour-piercing.' },
  { id: 8, chapter: 3, name: 'Siege Line',    theme: 'snow',     difficulty: 'hard',   enemyRace: 'robot', enemyTiers: 9,  tip: 'War Tanks outrange everything. Fast units close the gap before they reload.' },
  { id: 9, chapter: 3, name: 'Omega Protocol', theme: 'snow',    difficulty: 'brutal', enemyRace: 'robot', enemyTiers: 12, tip: 'Omega-01 fires an orbital beam down the lane. Spread out and strike from the flanks.' },
  { id: 10, chapter: 4, name: 'Mirror Match', theme: 'meadow',   difficulty: 'hard',   enemyRace: 'human', enemyTiers: 8,  tip: 'Humans answer everything. Change your composition faster than they can.' },
  { id: 11, chapter: 4, name: 'Royal Guard',  theme: 'swamp',    difficulty: 'brutal', enemyRace: 'human', enemyTiers: 11, tip: 'Royal Guards block arrows. Magic goes straight through their plate.' },
  { id: 12, chapter: 4, name: 'The King',     theme: 'meadow',   difficulty: 'brutal', enemyRace: 'human', enemyTiers: 12, tip: 'The King rallies everyone near him. Break the army before it reaches your gate.' },
];

export const STAGE_COUNT = STAGES.length;
