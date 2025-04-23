

/**
 * Represents a string that might be localized (e.g., for titles, names).
 */
interface LocalizedString {
  en: string;
  // Potentially other language codes could be added here, e.g., [lang: string]: string;
}

/**
 * Represents a speaker at the event.
 */
interface Speaker {
  code: string; // Unique identifier for the speaker
  name: string;
  avatar: string; // URL to the full avatar image (can be empty string)
  avatar_thumbnail_default: string; // URL to a default-sized thumbnail (can be empty string)
  avatar_thumbnail_tiny: string; // URL to a tiny thumbnail (can be empty string)
}

/**
 * Represents a room where talks/events take place.
 */
interface Room {
  id: number; // Unique identifier for the room
  name: LocalizedString;
  description: LocalizedString;
}

/**
 * Represents a track or category for talks.
 */
interface Track {
  id: number; // Unique identifier for the track
  name: LocalizedString;
  description: LocalizedString;
  color: string; // Hex color code as a string (e.g., "#000000")
}

/**
 * Represents a single talk, break, session, or other schedule item.
 * Note: Some fields are optional as they don't apply to all item types (e.g., breaks).
 */
interface Talk {
  id: number; // Unique identifier for the talk/event
  // Title can be a simple string or a localized object. Be mindful of this inconsistency.
  title: string | LocalizedString;
  start: string; // ISO 8601 DateTime string (e.g., "2025-04-23T06:00:00Z")
  end: string;   // ISO 8601 DateTime string (e.g., "2025-04-23T10:00:00+02:00")
  room: number; // ID of the Room this talk takes place in

  // Optional fields, often present for actual talks but not for breaks etc.
  code?: string; // Short code for the talk (e.g., "3MNGN8")
  abstract?: string; // Description of the talk content
  speakers?: string[]; // Array of Speaker codes associated with this talk
  track?: number; // ID of the Track this talk belongs to
  duration?: number; // Duration in minutes (seems redundant given start/end, but present)
  updated?: string; // ISO 8601 DateTime string indicating last update
  state?: string | null; // State of the talk (e.g., confirmed, cancelled - null observed)
  do_not_record?: boolean; // Flag indicating if the talk should not be recorded
}

/**
 * The root type representing the entire schedule data structure.
 */
interface ScheduleData {
  talks: Talk[];
  version: string; // Version identifier for the schedule data
  timezone: string; // Default timezone for the event (e.g., "Europe/Berlin")
  event_start: string; // Start date of the event (YYYY-MM-DD)
  event_end: string;   // End date of the event (YYYY-MM-DD)
  tracks: Track[];
  rooms: Room[];
  speakers: Speaker[];
}

// Example Usage (assuming you have the JSON data in a variable called `jsonDataString`)
/*
const jsonData: ScheduleData = JSON.parse(jsonDataString);

console.log(`Event starts on: ${jsonData.event_start}`);
console.log(`Number of talks/events: ${jsonData.talks.length}`);

const firstTalk = jsonData.talks[0];
if (firstTalk) {
    // Accessing properties with type safety
    console.log(`First event ID: ${firstTalk.id}`);
    // Need to check if title is string or object
    const title = typeof firstTalk.title === 'string' ? firstTalk.title : firstTalk.title.en;
    console.log(`First event title: ${title}`);
}
*/

