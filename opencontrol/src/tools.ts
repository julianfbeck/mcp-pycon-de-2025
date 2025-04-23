import { tool } from 'opencontrol/tool'
import { z } from 'zod'
import { Database } from 'bun:sqlite'

// Initialize the SQLite database connection
const dbPath = process.env.DB_PATH || 'schedule.db'
const db = new Database(dbPath, { create: true, readwrite: true })

// Enable foreign keys
db.exec("PRAGMA foreign_keys = ON;")
// Set busy timeout to 5 seconds
db.exec("PRAGMA busy_timeout = 5000;")


export const sqlite_schedule_read = tool({
  name: "sqlite_schedule_read",
  description: "Execute a readonly SQLite query to fetch data from the schedule database. Use this for querying talks, speakers, rooms, tracks, and talk-speaker relationships in the conference schedule.",
  args: z.object({ 
    query: z.string().describe("The SQL query to execute on the schedule database (SELECT only)") 
  }),
  async run(input) {
    if (!input.query.trim().toLowerCase().startsWith('select')) {
      throw new Error("Only SELECT queries are allowed with this tool.")
    }
    
    try {
      const stmt = db.prepare(input.query)
      const results = stmt.all()
      return {
        success: true,
        results: results
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
})

export const sqlite_schedule_schema = tool({
  name: "sqlite_schedule_schema",
  description: "Retrieve the schema information for the conference schedule database, including tables, columns, and their data types.",
  async run() {
    try {
      // Get all table names
      const tablesQuery = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);
      const tables = tablesQuery.all() as { name: string }[];
      
      const schema: Record<string, any> = {};
      
      // For each table, get its column information
      for (const table of tables) {
        const tableName = table.name;
        const tableInfoQuery = db.prepare(`PRAGMA table_info(${tableName})`);
        const columns = tableInfoQuery.all();
        
        // Get foreign key information
        const foreignKeysQuery = db.prepare(`PRAGMA foreign_key_list(${tableName})`);
        const foreignKeys = foreignKeysQuery.all();
        
        schema[tableName] = {
          columns,
          foreignKeys
        };
      }
      
      return {
        success: true,
        schema: schema
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
})

export const get_talks_by_speaker = tool({
  name: "get_talks_by_speaker",
  description: "Get all talks that a specific speaker is presenting at the conference",
  args: z.object({
    speaker_code: z.string().describe("The unique code identifier for the speaker")
  }),
  async run(input) {
    try {
      const query = db.prepare(`
        SELECT t.*, s.name as speaker_name, r.name as room_name, tr.name as track_name
        FROM talks t
        JOIN talk_speakers ts ON t.id = ts.talk_id
        JOIN speakers s ON ts.speaker_code = s.code
        LEFT JOIN rooms r ON t.room = r.id
        LEFT JOIN tracks tr ON t.track = tr.id
        WHERE ts.speaker_code = ?
        ORDER BY t.start
      `);
      
      const results = query.all(input.speaker_code);
      
      if (Array.isArray(results) && results.length === 0) {
        return {
          success: true,
          message: `No talks found for speaker with code: ${input.speaker_code}`,
          results: []
        };
      }
      
      return {
        success: true,
        results: results
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
})

export const get_talks_by_room = tool({
  name: "get_talks_by_room",
  description: "Get all talks scheduled in a specific room at the conference",
  args: z.object({
    room_id: z.number().describe("The ID of the room")
  }),
  async run(input) {
    try {
      const query = db.prepare(`
        SELECT t.*, r.name as room_name, tr.name as track_name
        FROM talks t
        JOIN rooms r ON t.room = r.id
        LEFT JOIN tracks tr ON t.track = tr.id
        WHERE t.room = ?
        ORDER BY t.start
      `);
      
      const results = query.all(input.room_id);
      
      if (Array.isArray(results) && results.length === 0) {
        return {
          success: true,
          message: `No talks found for room with ID: ${input.room_id}`,
          results: []
        };
      }
      
      return {
        success: true,
        results: results
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}) 