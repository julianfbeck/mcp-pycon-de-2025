import { tool } from 'opencontrol/tool'
import { z } from 'zod'
import { Database } from 'bun:sqlite'

const POKE_API_BASE = 'https://pokeapi.co/api/v2'

// Initialize the SQLite database connection
const dbPath = process.env.DB_PATH || 'schedule.db'
console.log(`Using database at: ${dbPath}`)
const db = new Database(dbPath, { create: true, readwrite: true })

// Enable foreign keys
db.exec("PRAGMA foreign_keys = ON;")
// Set busy timeout to 5 seconds
db.exec("PRAGMA busy_timeout = 5000;")

// Create the caught_pokemon table if it doesn't exist
try {
  console.log('Creating caught_pokemon table if it does not exist')
  db.exec(`
    CREATE TABLE IF NOT EXISTS caught_pokemon (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokemon_id INTEGER NOT NULL,
      pokemon_name TEXT NOT NULL,
      user_id TEXT DEFAULT 'default_user',
      caught_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      location TEXT,
      level INTEGER DEFAULT 50,
      nickname TEXT
    );
  `)
  console.log('Table creation successful')
} catch (error) {
  console.error('Error creating caught_pokemon table:', error)
}

// Helper function to fetch from PokeAPI
async function fetchPokeAPI(endpoint: string) {
  try {
    const response = await fetch(`${POKE_API_BASE}${endpoint}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    throw error
  }
}

// Helper function to compress Pokemon data by removing verbose fields
function compressPokemonData(data: any) {
  // Make a shallow copy of the data
  const compressedData = {...data};
  
  // Remove verbose fields that contain large amounts of data
  delete compressedData.game_indices;
  delete compressedData.moves;
  delete compressedData.sprites;
  delete compressedData.held_items;
  
  // If stats exist, simplify them to a more readable format
  if (compressedData.stats) {
    const simplifiedStats: Record<string, number> = {};
    compressedData.stats.forEach((stat: any) => {
      simplifiedStats[stat.stat.name] = stat.base_stat;
    });
    compressedData.stats = simplifiedStats;
  }
  
  return compressedData;
}

// Helper function to validate if a Pokemon exists
async function validatePokemon(pokemonIdOrName: string | number): Promise<{id: number, name: string} | null> {
  try {
    const data = await fetchPokeAPI(`/pokemon/${pokemonIdOrName.toString().toLowerCase()}`)
    return { id: data.id, name: data.name }
  } catch (error) {
    return null
  }
}

export const pokemon_read = tool({
  name: "pokemon_read",
  description: "Execute a read operation on the Pokemon API to fetch data about Pokemon, their types, abilities, and other attributes.",
  args: z.object({ 
    endpoint: z.string().describe("The API endpoint to query (e.g., '/pokemon/1', '/type/fire', '/ability/overgrow')")
  }),
  async run(input) {
    try {
      const results = await fetchPokeAPI(input.endpoint);
      
      // Determine if this is a Pokemon endpoint
      const isPokemonEndpoint = input.endpoint.startsWith('/pokemon/') && !input.endpoint.includes('species');
      
      // Always compress if it's a Pokemon endpoint
      const processedResults = isPokemonEndpoint 
        ? compressPokemonData(results) 
        : results;
      
      return {
        success: true,
        results: processedResults
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
})

export const pokemon_schema = tool({
  name: "pokemon_schema",
  description: "Retrieve information about the available Pokemon API endpoints and their data structures.",
  async run() {
    try {
      const endpoints = [
        '/pokemon',
        '/type',
        '/ability',
        '/move',
        '/species'
      ]
      
      const schema: Record<string, any> = {}
      
      for (const endpoint of endpoints) {
        const response = await fetchPokeAPI(endpoint)
        schema[endpoint] = {
          count: response.count,
          results: response.results.slice(0, 5), // Show first 5 items as examples
          description: `Endpoint for ${endpoint.slice(1)} data`
        }
      }
      
      return {
        success: true,
        schema: schema
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
})

export const get_pokemon_by_type = tool({
  name: "get_pokemon_by_type",
  description: "Get all Pokemon of a specific type",
  args: z.object({
    type: z.string().describe("The Pokemon type (e.g., 'fire', 'water', 'grass')")
  }),
  async run(input) {
    try {
      const typeData = await fetchPokeAPI(`/type/${input.type.toLowerCase()}`)
      
      const pokemon = typeData.pokemon.map((p: any) => ({
        name: p.pokemon.name,
        slot: p.slot
      }))
      
      if (pokemon.length === 0) {
        return {
          success: true,
          message: `No Pokemon found for type: ${input.type}`,
          results: []
        }
      }
      
      return {
        success: true,
        results: pokemon
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
})

export const get_pokemon_by_ability = tool({
  name: "get_pokemon_by_ability",
  description: "Get all Pokemon that have a specific ability",
  args: z.object({
    ability: z.string().describe("The ability name (e.g., 'overgrow', 'blaze', 'torrent')")
  }),
  async run(input) {
    try {
      const abilityData = await fetchPokeAPI(`/ability/${input.ability.toLowerCase()}`)
      
      const pokemon = abilityData.pokemon.map((p: any) => ({
        name: p.pokemon.name,
        is_hidden: p.is_hidden
      }))
      
      if (pokemon.length === 0) {
        return {
          success: true,
          message: `No Pokemon found with ability: ${input.ability}`,
          results: []
        }
      }
      
      return {
        success: true,
        results: pokemon
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
})

export const catch_pokemon = tool({
  name: "catch_pokemon",
  description: "Catch a Pokemon and add it to your collection",
  args: z.object({
    pokemon_id_or_name: z.union([z.number(), z.string()]).describe("The Pokemon's ID or name"),
    nickname: z.string().optional().describe("Optional nickname for your caught Pokemon"),
    location: z.string().optional().describe("Where you caught this Pokemon"),
    level: z.number().optional().describe("The level of the caught Pokemon (default: 50)")
  }),
  async run(input) {
    try {
      console.log(`Attempting to catch Pokemon: ${input.pokemon_id_or_name}`);
      
      // Validate the Pokemon exists
      const pokemon = await validatePokemon(input.pokemon_id_or_name);
      if (!pokemon) {
        console.log(`Pokemon not found: ${input.pokemon_id_or_name}`);
        return {
          success: false,
          error: `Pokemon with ID/name '${input.pokemon_id_or_name}' not found`
        };
      }
      
      console.log(`Pokemon validated: ${pokemon.name} (ID: ${pokemon.id})`);
      
      // Add to caught Pokemon
      console.log(`Catching ${pokemon.name}`);
      const insertStmt = db.prepare(`
        INSERT INTO caught_pokemon (pokemon_id, pokemon_name, nickname, location, level)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      insertStmt.run(
        pokemon.id,
        pokemon.name,
        input.nickname || null,
        input.location || "Unknown location",
        input.level || 50
      );
      
      console.log(`Successfully caught ${pokemon.name}`);
      
      // Calculate catch success message
      const catchMessages = [
        `Gotcha! ${pokemon.name} was caught!`,
        `You caught ${pokemon.name}!`,
        `${pokemon.name} was caught successfully!`,
        `${pokemon.name} is now part of your team!`
      ];
      
      const catchMessage = catchMessages[Math.floor(Math.random() * catchMessages.length)];
      
      return {
        success: true,
        message: catchMessage,
        pokemon: {
          id: pokemon.id,
          name: pokemon.name,
          nickname: input.nickname,
          level: input.level || 50,
          caught_at: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error catching Pokemon:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
})

export const get_caught_pokemon = tool({
  name: "get_caught_pokemon",
  description: "Get all your caught Pokemon from your collection",
  async run() {
    try {
      console.log('Fetching all caught Pokemon');
      
      const query = db.prepare(`
        SELECT * FROM caught_pokemon
        WHERE user_id = 'default_user'
        ORDER BY caught_at DESC
      `);
      
      const caughtPokemon = query.all();
      console.log(`Found ${caughtPokemon.length} caught Pokemon`);
      
      if (caughtPokemon.length === 0) {
        return {
          success: true,
          message: "You haven't caught any Pokemon yet",
          results: []
        };
      }
      
      return {
        success: true,
        results: caughtPokemon
      };
    } catch (error) {
      console.error('Error fetching caught Pokemon:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
})

export const release_pokemon = tool({
  name: "release_pokemon",
  description: "Release a caught Pokemon back into the wild",
  args: z.object({
    pokemon_id: z.number().describe("The database ID of the caught Pokemon to release (not the Pokemon's species ID)")
  }),
  async run(input) {
    try {
      // Get the Pokemon details before deleting
      const getPokemonQuery = db.prepare(`
        SELECT pokemon_name, nickname FROM caught_pokemon
        WHERE id = ? AND user_id = 'default_user'
      `);
      
      const pokemon = getPokemonQuery.get(input.pokemon_id) as { pokemon_name: string, nickname: string | null } | null;
      
      if (!pokemon) {
        return {
          success: false,
          error: `No caught Pokemon found with ID: ${input.pokemon_id}`
        };
      }
      
      // Release the Pokemon
      const deleteStmt = db.prepare(`
        DELETE FROM caught_pokemon
        WHERE id = ? AND user_id = 'default_user'
      `);
      
      deleteStmt.run(input.pokemon_id);
      
      const displayName = pokemon.nickname || pokemon.pokemon_name;
      
      return {
        success: true,
        message: `${displayName} was released back into the wild. Bye bye, ${displayName}!`
      };
    } catch (error) {
      console.error('Error releasing Pokemon:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
})

export const search_caught_pokemon = tool({
  name: "search_caught_pokemon",
  description: "Search your caught Pokemon by name or nickname",
  args: z.object({
    search_term: z.string().describe("The search term to look for in Pokemon names or nicknames")
  }),
  async run(input) {
    try {
      const searchTerm = `%${input.search_term.toLowerCase()}%`;
      
      const query = db.prepare(`
        SELECT * FROM caught_pokemon
        WHERE (LOWER(pokemon_name) LIKE ? OR LOWER(nickname) LIKE ?) AND user_id = 'default_user'
        ORDER BY caught_at DESC
      `);
      
      const results = query.all(searchTerm, searchTerm);
      
      if (results.length === 0) {
        return {
          success: true,
          message: `No caught Pokemon found matching '${input.search_term}'`,
          results: []
        };
      }
      
      return {
        success: true,
        results: results
      };
    } catch (error) {
      console.error('Error searching caught Pokemon:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}) 