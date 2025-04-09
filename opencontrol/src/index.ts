import { createAnthropic } from '@ai-sdk/anthropic'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { create } from 'opencontrol'
import { tool } from 'opencontrol/tool'
import 'dotenv/config'

const inventory = tool({
  name: "inventory_record",
  description: "Record new inventory event to track in or out amounts",
  async run(input: any) {
    return "Inventory record"
  },
})

const app = create({
  model: createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })("claude-3-7-sonnet-20250219"),
  password: "",
  tools: [inventory]
})

serve({
  fetch: app.fetch,
  port: 3001
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
