import { createAnthropic } from '@ai-sdk/anthropic'
import { create } from 'opencontrol'
import { Hono } from 'hono'
import { 
  sqlite_schedule_read, 
  sqlite_schedule_schema,
  get_talks_by_speaker,
  get_talks_by_room
} from './tools.js'

const app = create({
  model: createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })("claude-3-7-sonnet-20250219"),
  password: "",
  tools: [
    sqlite_schedule_read, 
    sqlite_schedule_schema,
    get_talks_by_speaker,
    get_talks_by_room
  ]
})

export default app;