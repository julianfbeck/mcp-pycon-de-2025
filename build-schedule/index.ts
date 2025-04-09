import { Database } from "bun:sqlite";
import { constants } from "bun:sqlite";

// Database configuration
const DB_PATH = "schedule.db";

// Initialize database with WAL mode and other optimizations
const db = new Database(DB_PATH, {
  create: true, // Create database if it doesn't exist
  readwrite: true, // Allow read and write operations
});


// Ensure WAL mode is not persistent to prevent lingering files
db.fileControl(constants.SQLITE_FCNTL_PERSIST_WAL, 0);
// Enable foreign keys
db.exec("PRAGMA foreign_keys = ON;");
// Set busy timeout to 5 seconds
db.exec("PRAGMA busy_timeout = 5000;");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS talks (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE,
    title TEXT NOT NULL,
    abstract TEXT,
    start TEXT NOT NULL,
    end TEXT NOT NULL,
    room INTEGER NOT NULL,
    track INTEGER,
    duration INTEGER,
    updated TEXT,
    state TEXT,
    do_not_record BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (room) REFERENCES rooms(id),
    FOREIGN KEY (track) REFERENCES tracks(id)
  );

  CREATE TABLE IF NOT EXISTS speakers (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT,
    avatar_thumbnail_default TEXT,
    avatar_thumbnail_tiny TEXT
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT
  );

  CREATE TABLE IF NOT EXISTS talk_speakers (
    talk_id INTEGER,
    speaker_code TEXT,
    PRIMARY KEY (talk_id, speaker_code),
    FOREIGN KEY (talk_id) REFERENCES talks(id),
    FOREIGN KEY (speaker_code) REFERENCES speakers(code)
  );
`);

// Prepared statements for common operations
const insertTalk = db.prepare(`
  INSERT OR REPLACE INTO talks (
    id, code, title, abstract, start, end, room, track,
    duration, updated, state, do_not_record
  ) VALUES (
    $id, $code, $title, $abstract, $start, $end, $room, $track,
    $duration, $updated, $state, $do_not_record
  )
`);

const insertSpeaker = db.prepare(`
  INSERT OR REPLACE INTO speakers (
    code, name, avatar, avatar_thumbnail_default, avatar_thumbnail_tiny
  ) VALUES (
    $code, $name, $avatar, $avatar_thumbnail_default, $avatar_thumbnail_tiny
  )
`);

const insertRoom = db.prepare(`
  INSERT OR REPLACE INTO rooms (id, name, description)
  VALUES ($id, $name, $description)
`);

const insertTrack = db.prepare(`
  INSERT OR REPLACE INTO tracks (id, name, description, color)
  VALUES ($id, $name, $description, $color)
`);

const insertTalkSpeaker = db.prepare(`
  INSERT OR IGNORE INTO talk_speakers (talk_id, speaker_code)
  VALUES ($talk_id, $speaker_code)
`);

// Transaction for bulk operations
const insertScheduleData = db.transaction((data: any) => {
  console.log(`Processing ${data.rooms?.length || 0} rooms, ${data.tracks?.length || 0} tracks, ${data.speakers?.length || 0} speakers, ${data.talks?.length || 0} talks`);
  
  // Insert rooms
  if (data.rooms && Array.isArray(data.rooms)) {
    for (const room of data.rooms) {
      insertRoom.run({
        $id: room.id,
        $name: typeof room.name === 'string' 
          ? room.name 
          : (room.name && room.name.en ? room.name.en : JSON.stringify(room.name)),
        $description: room.description 
          ? (typeof room.description === 'string' 
              ? room.description 
              : (room.description && room.description.en ? room.description.en : JSON.stringify(room.description)))
          : null
      });
    }
  }

  // Insert tracks
  if (data.tracks && Array.isArray(data.tracks)) {
    for (const track of data.tracks) {
      insertTrack.run({
        $id: track.id,
        $name: typeof track.name === 'string' 
          ? track.name 
          : (track.name && track.name.en ? track.name.en : JSON.stringify(track.name)),
        $description: track.description 
          ? (typeof track.description === 'string' 
              ? track.description 
              : (track.description && track.description.en ? track.description.en : JSON.stringify(track.description)))
          : null,
        $color: track.color || null
      });
    }
  }

  // Insert speakers
  if (data.speakers && Array.isArray(data.speakers)) {
    for (const speaker of data.speakers) {
      insertSpeaker.run({
        $code: speaker.code,
        $name: speaker.name,
        $avatar: speaker.avatar || '',
        $avatar_thumbnail_default: speaker.avatar_thumbnail_default || '',
        $avatar_thumbnail_tiny: speaker.avatar_thumbnail_tiny || ''
      });
    }
  }

  // Insert talks and speaker associations
  if (data.talks && Array.isArray(data.talks)) {
    for (const talk of data.talks) {
      insertTalk.run({
        $id: talk.id,
        $code: talk.code || null,
        $title: typeof talk.title === 'string' 
          ? talk.title 
          : (talk.title && talk.title.en ? talk.title.en : JSON.stringify(talk.title)),
        $abstract: talk.abstract || null,
        $start: talk.start,
        $end: talk.end,
        $room: talk.room,
        $track: talk.track || null,
        $duration: talk.duration || null,
        $updated: talk.updated || null,
        $state: talk.state || null,
        $do_not_record: talk.do_not_record ? 1 : 0
      });

      // Insert speaker associations
      if (talk.speakers && Array.isArray(talk.speakers)) {
        for (const speakerCode of talk.speakers) {
          insertTalkSpeaker.run({
            $talk_id: talk.id,
            $speaker_code: speakerCode
          });
        }
      }
    }
  }
  
  return {
    rooms: data.rooms?.length || 0,
    tracks: data.tracks?.length || 0,
    speakers: data.speakers?.length || 0,
    talks: data.talks?.length || 0
  };
});

/**
 * Fetches schedule data from a URL and inserts it into the database
 * @param url URL to fetch schedule data from
 * @returns Statistics about imported data
 */
async function fetchAndImportSchedule(url: string) {
  console.log(`Fetching schedule data from ${url}...`);
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    console.log("Data fetched successfully, parsing JSON...");
    const data = await response.json();
    
    // Basic validation
    if (!data || typeof data !== 'object') {
      throw new Error("Invalid data format: not an object");
    }
    
    console.log("Importing data into database...");
    const stats = insertScheduleData(data);
    
    console.log(`Import completed successfully!`);
    console.log(`Imported: ${stats.rooms} rooms, ${stats.tracks} tracks, ${stats.speakers} speakers, ${stats.talks} talks`);
    
    return stats;
  } catch (error) {
    console.error("Error importing schedule data:", error);
    throw error;
  }
}

/**
 * Get row count for a specific table
 * @param tableName Name of the table to count rows in
 * @returns Number of rows in the table
 */
function getTableRowCount(tableName: string): number {
  const query = db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
  const result = query.get() as { count: number } | undefined;
  return result ? result.count : 0;
}

/**
 * Log the number of rows in each table
 */
function logTableRowCounts() {
  const tables = ['talks', 'speakers', 'rooms', 'tracks', 'talk_speakers'];
  
  console.log("\n===== Database Table Row Counts =====");
  
  for (const table of tables) {
    const count = getTableRowCount(table);
    console.log(`${table}: ${count} rows`);
  }
  
  console.log("=====================================\n");
}

// Main function to fetch and import schedule data
async function main() {
  const scheduleUrl = "https://pretalx.com/pyconde-pydata-2025/schedule/v/0.18/widgets/schedule.json";
  
  try {
    const stats = await fetchAndImportSchedule(scheduleUrl);
    console.log("Schedule data imported successfully");
    console.log(stats);
    
    // Log table row counts after import
    logTableRowCounts();
  } catch (error) {
    console.error("Failed to import schedule data:", error);
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (import.meta.path === Bun.main) {
  main();
}

// Export database instance and prepared statements
export {
  db,
  insertTalk,
  insertSpeaker,
  insertRoom,
  insertTrack,
  insertTalkSpeaker,
  insertScheduleData,
  fetchAndImportSchedule,
  getTableRowCount,
  logTableRowCounts
}; 