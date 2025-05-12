import { tool } from 'opencontrol/tool'
import { z } from 'zod'

// Type effectiveness chart
const TYPE_EFFECTIVENESS: Record<string, Record<string, number>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fighting: 2, poison: 0.5, bug: 0.5, dragon: 2, dark: 2, steel: 0.5 }
};

// Pokemon stat calculation
function calculateStat(baseStat: number, level: number, iv: number = 31, ev: number = 0, nature: number = 1): number {
  // Pokemon stat formula: ((2 * Base + IV + (EV/4)) * Level/100 + 5) * Nature
  return Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level / 100 + 5) * nature);
}

// Calculate HP
function calculateHP(baseHP: number, level: number, iv: number = 31, ev: number = 0): number {
  // HP formula: ((2 * Base + IV + (EV/4)) * Level/100) + Level + 10
  return Math.floor((2 * baseHP + iv + Math.floor(ev / 4)) * level / 100) + level + 10;
}

// Calculate damage
function calculateDamage(
  attacker: any, 
  defender: any, 
  move: any
): { damage: number, effectiveness: number, isCritical: boolean } {
  // Basic damage formula: ((2 * Level / 5 + 2) * Power * A/D / 50 + 2) * STAB * Type effectiveness
  const level = attacker.level || 50;
  const power = move.power || 0;
  
  // Skip if move has no power (status move)
  if (power === 0) return { damage: 0, effectiveness: 1, isCritical: false };
  
  // Determine if physical or special
  const isPhysical = move.damage_class?.name === 'physical';
  const attackStat = isPhysical ? attacker.stats.attack : attacker.stats.special_attack;
  const defenseStat = isPhysical ? defender.stats.defense : defender.stats.special_defense;
  
  // Base damage calculation
  let damage = Math.floor(((2 * level / 5 + 2) * power * attackStat / defenseStat) / 50) + 2;
  
  // STAB (Same Type Attack Bonus)
  const stab = attacker.types.some((type: any) => type.type.name === move.type.name) ? 1.5 : 1;
  damage = Math.floor(damage * stab);
  
  // Type effectiveness
  let effectiveness = 1;
  defender.types.forEach((defenderType: any) => {
    const moveType = move.type.name;
    if (TYPE_EFFECTIVENESS[moveType] && TYPE_EFFECTIVENESS[moveType][defenderType.type.name]) {
      effectiveness *= TYPE_EFFECTIVENESS[moveType][defenderType.type.name];
    }
  });
  damage = Math.floor(damage * effectiveness);
  
  // Random factor (85-100%)
  const randomFactor = (85 + Math.floor(Math.random() * 16)) / 100;
  damage = Math.floor(damage * randomFactor);
  
  // Critical hit (6.25% chance)
  const isCritical = Math.random() < 0.0625;
  if (isCritical) {
    damage = Math.floor(damage * 1.5);
  }
  
  return {
    damage,
    effectiveness,
    isCritical
  };
}

// Fetch Pokemon data with moves
async function fetchPokemonForBattle(pokemonId: string | number) {
  const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch Pokemon data for ${pokemonId}`);
  }
  
  const pokemonData = await response.json();
  
  // Ensure we have move data
  const moves = await Promise.all(
    pokemonData.moves
      .slice(0, 4) // Just get 4 moves for simplicity
      .map(async (moveEntry: any) => {
        const moveResponse = await fetch(moveEntry.move.url);
        return await moveResponse.json();
      })
  );
  
  // Return processed Pokemon data
  return {
    id: pokemonData.id,
    name: pokemonData.name,
    types: pokemonData.types,
    level: 50, // Default level
    stats: {
      hp: calculateHP(pokemonData.stats.find((s: any) => s.stat.name === 'hp').base_stat, 50),
      attack: calculateStat(pokemonData.stats.find((s: any) => s.stat.name === 'attack').base_stat, 50),
      defense: calculateStat(pokemonData.stats.find((s: any) => s.stat.name === 'defense').base_stat, 50),
      special_attack: calculateStat(pokemonData.stats.find((s: any) => s.stat.name === 'special-attack').base_stat, 50),
      special_defense: calculateStat(pokemonData.stats.find((s: any) => s.stat.name === 'special-defense').base_stat, 50),
      speed: calculateStat(pokemonData.stats.find((s: any) => s.stat.name === 'speed').base_stat, 50)
    },
    current_hp: calculateHP(pokemonData.stats.find((s: any) => s.stat.name === 'hp').base_stat, 50),
    moves: moves,
    status: null
  };
}

// Simulate a single turn
function simulateTurn(attacker: any, defender: any, attackerMove: any, defenderMove: any) {
  const events = [];
  
  // Determine who goes first (based on Speed)
  const attackerFirst = attacker.stats.speed >= defender.stats.speed;
  
  const first = attackerFirst ? attacker : defender;
  const second = attackerFirst ? defender : attacker;
  const firstMove = attackerFirst ? attackerMove : defenderMove;
  const secondMove = attackerFirst ? defenderMove : attackerMove;
  
  // First Pokemon's turn
  if (first.current_hp > 0) {
    const result = calculateDamage(first, second, firstMove);
    
    // Apply damage
    second.current_hp = Math.max(0, second.current_hp - result.damage);
    
    events.push({
      attacker: first.name,
      defender: second.name,
      move: firstMove.name,
      damage: result.damage,
      effectiveness: result.effectiveness === 2 ? "It's super effective!" : 
                     result.effectiveness === 0.5 ? "It's not very effective..." : 
                     result.effectiveness === 0 ? "It has no effect..." : "",
      critical: result.isCritical ? "Critical hit!" : "",
      remaining_hp: second.current_hp,
      fainted: second.current_hp <= 0
    });
    
    // Check if defender fainted
    if (second.current_hp <= 0) {
      events.push({
        message: `${second.name} fainted!`
      });
      return events;
    }
  }
  
  // Second Pokemon's turn
  if (second.current_hp > 0) {
    const result = calculateDamage(second, first, secondMove);
    
    // Apply damage
    first.current_hp = Math.max(0, first.current_hp - result.damage);
    
    events.push({
      attacker: second.name,
      defender: first.name,
      move: secondMove.name,
      damage: result.damage,
      effectiveness: result.effectiveness === 2 ? "It's super effective!" : 
                     result.effectiveness === 0.5 ? "It's not very effective..." : 
                     result.effectiveness === 0 ? "It has no effect..." : "",
      critical: result.isCritical ? "Critical hit!" : "",
      remaining_hp: first.current_hp,
      fainted: first.current_hp <= 0
    });
    
    // Check if defender fainted
    if (first.current_hp <= 0) {
      events.push({
        message: `${first.name} fainted!`
      });
    }
  }
  
  return events;
}

export const battle_pokemon = tool({
  name: "battle_pokemon",
  description: "Simulate a battle between two Pokemon with realistic battle mechanics",
  args: z.object({
    pokemon1: z.union([z.number(), z.string()]).describe("ID or name of the first Pokemon"),
    pokemon2: z.union([z.number(), z.string()]).describe("ID or name of the second Pokemon"),
    turns: z.number().optional().describe("Number of turns to simulate (default: 10)")
  }),
  async run(input) {
    try {
      console.log(`Simulating battle between ${input.pokemon1} and ${input.pokemon2}`);
      
      // Load Pokemon data
      const pokemon1 = await fetchPokemonForBattle(input.pokemon1);
      const pokemon2 = await fetchPokemonForBattle(input.pokemon2);
      
      console.log(`Loaded battle data for ${pokemon1.name} vs ${pokemon2.name}`);
      
      // Battle simulation
      const maxTurns = input.turns || 10;
      const battleLog = [];
      
      // Initial stats
      battleLog.push({
        type: "battle_start",
        pokemon1: {
          name: pokemon1.name,
          level: pokemon1.level,
          hp: pokemon1.current_hp,
          types: pokemon1.types.map((t: any) => t.type.name)
        },
        pokemon2: {
          name: pokemon2.name,
          level: pokemon2.level,
          hp: pokemon2.current_hp,
          types: pokemon2.types.map((t: any) => t.type.name)
        }
      });
      
      // Simulate turns
      let currentTurn = 1;
      while (currentTurn <= maxTurns && pokemon1.current_hp > 0 && pokemon2.current_hp > 0) {
        console.log(`Simulating turn ${currentTurn}`);
        
        // Select random moves for simplicity
        const pokemon1Move = pokemon1.moves[Math.floor(Math.random() * pokemon1.moves.length)];
        const pokemon2Move = pokemon2.moves[Math.floor(Math.random() * pokemon2.moves.length)];
        
        const turnEvents = simulateTurn(pokemon1, pokemon2, pokemon1Move, pokemon2Move);
        
        battleLog.push({
          type: "turn",
          turn: currentTurn,
          events: turnEvents
        });
        
        currentTurn++;
        
        // Check if either Pokemon fainted
        if (pokemon1.current_hp <= 0 || pokemon2.current_hp <= 0) {
          break;
        }
      }
      
      // Battle results
      let winner = null;
      if (pokemon1.current_hp <= 0 && pokemon2.current_hp <= 0) {
        winner = "draw";
      } else if (pokemon1.current_hp <= 0) {
        winner = pokemon2.name;
      } else if (pokemon2.current_hp <= 0) {
        winner = pokemon1.name;
      } else if (pokemon1.current_hp > pokemon2.current_hp) {
        winner = pokemon1.name;
      } else if (pokemon2.current_hp > pokemon1.current_hp) {
        winner = pokemon2.name;
      } else {
        winner = "draw";
      }
      
      battleLog.push({
        type: "battle_end",
        turns_simulated: currentTurn - 1,
        winner: winner,
        pokemon1_hp: pokemon1.current_hp,
        pokemon2_hp: pokemon2.current_hp
      });
      
      // Generate battle summary
      const summary = generateBattleSummary(battleLog, pokemon1, pokemon2);
      
      return {
        success: true,
        result: {
          winner: winner,
          summary: summary,
          battle_log: battleLog
        }
      };
    } catch (error) {
      console.error('Error simulating battle:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
});

// Helper function to generate a readable battle summary
function generateBattleSummary(battleLog: any[], pokemon1: any, pokemon2: any): string {
  const battle_start = battleLog[0];
  const battle_end = battleLog[battleLog.length - 1];
  
  let summary = `Battle between ${pokemon1.name.toUpperCase()} and ${pokemon2.name.toUpperCase()}\n\n`;
  
  // Initial stats
  summary += `${pokemon1.name} (Lv.${pokemon1.level}) - Types: ${pokemon1.types.map((t: any) => t.type.name).join(', ')}\n`;
  summary += `${pokemon2.name} (Lv.${pokemon2.level}) - Types: ${pokemon2.types.map((t: any) => t.type.name).join(', ')}\n\n`;
  
  // Battle highlights
  summary += `BATTLE HIGHLIGHTS:\n`;
  
  let highestDamage = 0;
  let criticalHits = 0;
  let superEffectiveHits = 0;
  let highestDamageMove = '';
  
  // Process turn events
  for (let i = 1; i < battleLog.length - 1; i++) {
    const turn = battleLog[i];
    if (turn.type === 'turn') {
      turn.events.forEach((event: any) => {
        if (event.damage > highestDamage) {
          highestDamage = event.damage;
          highestDamageMove = `${event.attacker} used ${event.move}`;
        }
        
        if (event.critical) criticalHits++;
        if (event.effectiveness && event.effectiveness.includes("super effective")) superEffectiveHits++;
        
        if (event.fainted) {
          summary += `- ${event.defender} fainted after ${event.attacker} used ${event.move}!\n`;
        }
      });
    }
  }
  
  summary += `- Highest damage: ${highestDamageMove} dealt ${highestDamage} damage\n`;
  summary += `- Critical hits: ${criticalHits}\n`;
  summary += `- Super effective hits: ${superEffectiveHits}\n\n`;
  
  // Battle result
  summary += `BATTLE RESULT: ${battle_end.winner.toUpperCase()} wins in ${battle_end.turns_simulated} turns!\n`;
  
  if (battle_end.winner !== 'draw') {
    const winner = battle_end.winner === pokemon1.name ? pokemon1 : pokemon2;
    const loser = battle_end.winner === pokemon1.name ? pokemon2 : pokemon1;
    const winnerHp = battle_end.winner === pokemon1.name ? battle_end.pokemon1_hp : battle_end.pokemon2_hp;
    const winnerMaxHp = battle_end.winner === pokemon1.name ? 
      pokemon1.stats.hp : pokemon2.stats.hp;
    
    summary += `${winner.name} had ${winnerHp}/${winnerMaxHp} HP remaining.\n`;
  } else {
    summary += `The battle ended in a draw!\n`;
  }
  
  return summary;
} 