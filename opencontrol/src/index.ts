import { createAnthropic } from '@ai-sdk/anthropic'
import { create } from 'opencontrol'
import { Hono } from 'hono'
import { 
  sqlite_schedule_read, 
  sqlite_schedule_schema,
  get_talks_by_speaker,
  get_talks_by_room
} from './tools.js'
import {
  pokemon_read,
  pokemon_schema,
  get_pokemon_by_type,
  get_pokemon_by_ability,
  catch_pokemon,
  get_caught_pokemon,
  release_pokemon,
  search_caught_pokemon
} from './pokemon-tools.js'
import {
  battle_pokemon
} from './pokemon-battle.js'

const app = create({
  model: createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })("claude-3-7-sonnet-20250219"),
  password: "",
  tools: [
    sqlite_schedule_read, 
    sqlite_schedule_schema,
    get_talks_by_speaker,
    get_talks_by_room,
    pokemon_read,
    pokemon_schema,
    get_pokemon_by_type,
    get_pokemon_by_ability,
    catch_pokemon,
    get_caught_pokemon,
    release_pokemon,
    search_caught_pokemon,
    battle_pokemon
  ]
})

export default app;