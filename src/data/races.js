// Race definitions: identity, passive, colours, AI personality and base style.
export const RACES = {
  human: {
    id: 'human', name: 'Human', title: 'Knight Era Kingdom',
    tagline: 'Disciplined steel and heraldry.',
    description: 'A medieval kingdom of knights, infantry, archers, priests and elite royal warriors.',
    identity: 'Balanced army with strong formations and a reliable answer to every threat.',
    passive: { id: 'formation', name: 'FORMATION', desc: 'Different Human unit types fighting side by side gain +5% damage and take 5% less damage per allied type nearby (up to 3).' },
    strengths: ['Answers for everything', 'Healing and rallies', 'Sturdy cavalry'],
    weaknesses: ['No extreme damage', 'Needs mixed squads'],
    difficulty: 1, colors: { primary: '#5b8def', secondary: '#dfe4ec', accent: '#ffd43a' },
    base: 'castle', ai: 'human', emblem: 'shield',
  },
  demon: {
    id: 'demon', name: 'Demon', title: 'Legion of Hell',
    tagline: 'Burn everything. Ask later.',
    description: 'An aggressive horde of demons, berserkers, hell knights, beasts and dark magic users.',
    identity: 'Massive offensive pressure and huge damage, but many units are fragile.',
    passive: { id: 'rage', name: 'RAGE', desc: 'Rage units gain up to +60% damage and +30% attack speed as their HP drops below half.' },
    strengths: ['Highest damage', 'Fast pushes', 'Lifesteal beasts'],
    weaknesses: ['Fragile units', 'Little armour', 'Punished by kiting'],
    difficulty: 2, colors: { primary: '#ff4d2e', secondary: '#3a1a2a', accent: '#ffb347' },
    base: 'fortress', ai: 'demon', emblem: 'horns',
  },
  robot: {
    id: 'robot', name: 'Robot', title: 'Iron Dominion',
    tagline: 'Armour, artillery, inevitability.',
    description: 'A mechanical army of combat bots, drones, tanks, artillery and giant war machines.',
    identity: 'Armour and ranged firepower balanced by slow movement and expensive units.',
    passive: { id: 'armorCore', name: 'ARMOR CORE', desc: 'Every machine has armour that reduces physical and pierce damage. Armour-piercing, magic and fire attacks ignore it.' },
    strengths: ['Heavy armour', 'Long range', 'Devastating late game'],
    weaknesses: ['Slow', 'Expensive', 'Weak to magic and armour-piercing'],
    difficulty: 3, colors: { primary: '#38e0ff', secondary: '#8c95a8', accent: '#ffd43a' },
    base: 'factory', ai: 'robot', emblem: 'gear',
  },
  mummy: {
    id: 'mummy', name: 'Mummy', title: 'Kingdom of the Dead',
    tagline: 'The sands never stop coming.',
    description: 'An ancient desert civilisation of undead warriors, scarabs, priests, golems and a mighty Pharaoh.',
    identity: 'Overwhelming numbers, regeneration and attrition. Losses come back.',
    passive: { id: 'undeath', name: 'UNDEATH', desc: 'Undead units regenerate. Some rise again after falling, and some burst into scarabs when destroyed.' },
    strengths: ['Cheap numbers', 'Regeneration', 'Units that refuse to die'],
    weaknesses: ['Low single-unit damage', 'Weak to fire and area attacks'],
    difficulty: 2, colors: { primary: '#f0c95c', secondary: '#e8dcc0', accent: '#4fd0ff' },
    base: 'temple', ai: 'mummy', emblem: 'ankh',
  },
};

export const RACE_ORDER = ['human', 'demon', 'robot', 'mummy'];

// Tag glossary shown in the codex / how-to.
export const TAGS = {
  LIGHT: 'Light — cheap and fragile', HEAVY: 'Heavy — big and slow', ARMORED: 'Armored — shrugs off physical hits',
  RANGED: 'Ranged — attacks from afar', MELEE: 'Melee — fights up close', CAVALRY: 'Cavalry — fast chargers',
  SWARM: 'Swarm — many small bodies', MAGIC: 'Magic — spells ignore armour', MECHANICAL: 'Mechanical — machine', UNDEAD: 'Undead — regenerates', ELITE: 'Elite — rare and powerful',
};
