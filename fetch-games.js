// Save as fetch-games.js
import fetch from "node-fetch";
import { writeFileSync, readFileSync } from "fs";
import { generateIndexHTML } from "./build-html.js";

// Read config file from command line argument
if (process.argv.length < 3) {
  console.error("Usage: node fetch-games.js <config-file>");
  console.error("Example: node fetch-games.js u12.json");
  process.exit(1);
}

const configFile = `teams/${process.argv[2]}`;
let config;

try {
  const configContent = readFileSync(configFile, 'utf8');
  config = JSON.parse(configContent);
} catch (error) {
  console.error(`Error reading config file ${configFile}:`, error.message);
  process.exit(1);
}

// Validate required config fields
if (!config.competitionId || !config.teamName || !config.teamId) {
  console.error("Config file must contain: competitionId, teamName, teamId");
  process.exit(1);
}

// Use teamId from config instead of inferring from filename
const teamShortcut = config.teamId;

const COMPETITION_URL = `https://www.basketball-bund.net/rest/competition/spielplan/id/${config.competitionId}`;
const MATCH_URL = (id) => `https://www.basketball-bund.net/rest/match/id/${id}/matchInfo`;
const TEAM_NAME = config.teamName;
const ICS_FILENAME = `docs/ics/${config.teamId}.ics`;

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

function formatDateForICS(dateStr, timeStr) {
  let day, month, year;

  // Check if date is in YYYY-MM-DD format or DD.MM.YYYY format
  if (dateStr.includes('-')) {
    // YYYY-MM-DD format
    [year, month, day] = dateStr.split('-');
  } else if (dateStr.includes('.')) {
    // DD.MM.YYYY format
    [day, month, year] = dateStr.split('.');
  } else {
    throw new Error(`Unsupported date format: ${dateStr}`);
  }

  const [hours, minutes] = timeStr.split(':');

  // Handle placeholder times like 23:59 (TBD)
  if (timeStr === '23:59') {
    // Set to 00:00 for TBD games - return local time format
    return `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}T000000`;
  }

  // Format as YYYYMMDDTHHMMSS for ICS (local time, no timezone conversion)
  const formattedDate = `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
  const formattedTime = `${hours.padStart(2, '0')}${minutes.padStart(2, '0')}00`;

  return `${formattedDate}T${formattedTime}`;
}

function addHoursToTime(timeStr, hoursToAdd) {
  // Handle placeholder times
  if (timeStr === '23:59') {
    return '23:59'; // Keep as is for TBD games
  }

  const [hours, minutes] = timeStr.split(':').map(Number);
  const newHours = hours + hoursToAdd;

  // Handle overflow past 24 hours
  if (newHours >= 24) {
    return '23:59'; // Cap at 23:59 for same day
  }

  return `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function createICSEvent(game) {
  const dtStart = formatDateForICS(game.date, game.time);
  const endTime = addHoursToTime(game.time, 2);
  const dtEnd = formatDateForICS(game.date, endTime);

  // Location: format as "Street; ZIP City" as requested
  const location = `${game.venue.street}; ${game.venue.zip} ${game.venue.city}`;

  // Create a description with venue name and full address
  const description = `Venue: ${game.venue.name || 'TBD'}\\nAddress: ${location}`;

  // Add TBD indicator for games with placeholder times
  const timeIndicator = game.time === '23:59' ? ' (Zeit TBD)' : '';

  // Add venue name in brackets to the title
  const venueInTitle = game.venue.name ? ` (${game.venue.name})` : '';
  const summary = `${teamShortcut}: ${game.home} vs ${game.guest}${timeIndicator}${venueInTitle}`;

  return [
    'BEGIN:VEVENT',
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    `UID:${game.matchId}@bc-lions-moabit`,
    'END:VEVENT'
  ].join('\r\n');
}

function createICSFile(games) {
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BC Lions Moabit//Basketball Schedule//EN',
    'CALSCALE:GREGORIAN'
  ].join('\r\n');

  const footer = 'END:VCALENDAR';

  const events = games.map(createICSEvent).join('\r\n');

  return [header, events, footer].join('\r\n');
}

async function main() {
  try {
    // Step 1: Get competition matches
    const competition = await fetchJSON(COMPETITION_URL);
    const matches = competition.data.matches;

    const results = [];

    // Step 2: For each match, fetch matchInfo
    for (const m of matches) {
      const matchInfoData = await fetchJSON(MATCH_URL(m.matchId));
      const spielfeld = matchInfoData.data.matchInfo?.spielfeld || {};

      results.push({
        date: m.kickoffDate,
        time: m.kickoffTime,
        home: m.homeTeam.teamname,
        guest: m.guestTeam.teamname,
        matchId: m.matchId,
        venue: {
          name: spielfeld.bezeichnung || null,
          street: spielfeld.strasse || null,
          zip: spielfeld.plz || null,
          city: spielfeld.ort || null,
        },
      });
    }

    // Step 3: Filter for BC Lions Moabit 1 mix games
    const bcLionsGames = results.filter(game =>
      game.home.includes(TEAM_NAME) || game.guest.includes(TEAM_NAME)
    );

    console.log(`Found ${bcLionsGames.length} games for ${TEAM_NAME}:`);
    bcLionsGames.forEach(game => {
      console.log(`${game.date} ${game.time} - ${game.home} vs ${game.guest}`);
    });

    // Step 4: Create ICS file
    if (bcLionsGames.length > 0) {
      const icsContent = createICSFile(bcLionsGames);
      writeFileSync(ICS_FILENAME, icsContent);
      console.log(`\nICS file created: ${ICS_FILENAME}`);
    } else {
      console.log('No games found for BC Lions Moabit 1 mix');
    }

    console.log('\nAll games:');
    console.log(JSON.stringify(results, null, 2));

    // Generate the HTML file with current configurations
    try {
      console.log('\nGenerating index.html...');
      generateIndexHTML();
    } catch (htmlError) {
      console.error('Error generating HTML:', htmlError);
    }

  } catch (err) {
    console.error("Error:", err);
  }
}

main();
