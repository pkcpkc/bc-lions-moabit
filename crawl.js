#!/usr/bin/env node
import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

const TEAM_NAME_TO_SEARCH = "BC Lions Moabit";

const API_URL = "https://www.basketball-bund.net/rest/wam/liga/list";
const COMPETITION_URL = "https://www.basketball-bund.net/rest/competition/spielplan/id";

async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fetch(url, options);
        } catch (error) {
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            } else {
                throw error;
            }
        }
    }
}

async function fetchLeagues(verbandId) {
    let allLeagues = [];
    let startAtIndex = 0;
    let hasMoreData = true;

    while (hasMoreData) {
        const response = await fetchWithRetry(`${API_URL}?startAtIndex=${startAtIndex}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ "wam": { "verbandIds": [verbandId] } }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch leagues for verband ${verbandId}: ${response.status}`);
        }

        const data = await response.json();
        const { ligen, hasMoreData: moreData } = data.data;

        allLeagues = allLeagues.concat(ligen);
        hasMoreData = moreData;
        startAtIndex += ligen.length;
    }

    return allLeagues;
}

async function fetchCompetition(leagueId) {
    const response = await fetchWithRetry(`${COMPETITION_URL}/${leagueId}`);
    if (!response.ok) {
        // A 404 is okay here, it just means the league has no schedule yet
        if (response.status === 404) {
            return null;
        }
        throw new Error(`Failed to fetch competition for league ${leagueId}: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
}

function findTeam(match, teamName) {
    if (match.homeTeam && match.homeTeam.teamname.startsWith(teamName)) {
        return match.homeTeam;
    }
    if (match.guestTeam && match.guestTeam.teamname.startsWith(teamName)) {
        return match.guestTeam;
    }
    return null;
}

function sanitizeForFilename(name) {
    const sanitized = name.toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss');
    return sanitized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function shortcutForTeamId(teamId) {

    let shortcut = teamId.replace('.json', '');
    let isMini = false;

    // Handle special case: mini leagues
    if (shortcut.startsWith('mini-')) {
        shortcut = shortcut.substring(5); // e.g. "mini-u11-fortgeschrittene-1" -> "u11-fortgeschrittene-1"
        isMini = true;
    }

    const parts = shortcut.split('-');

    const genderMap = {
        damen: 'da',
        herren: 'he'
    };

    let shortcutParts = [];

    // Gender or team prefix (damen, herren, mu12, wu14, etc.)
    if (genderMap[parts[0]]) {
        shortcutParts.push(genderMap[parts[0]]);
        parts.shift();
    } else if (/^(?:m|w)?u\d+/.test(parts[0])) {
        shortcutParts.push(parts[0]);
        parts.shift();
    }

    // Handle 'bbv-pokal' as one unit
    if (parts[0] === 'bbv' && parts[1] === 'pokal') {
        shortcutParts.push('pokal');
        parts.splice(0, 2);
    } else if (parts[0] === 'pokal') {
        shortcutParts.push('pokal');
        parts.shift();
    }

    // Handle leagues like bezirksliga, kreisliga, etc.
    if (parts[0] && parts[0].includes('liga')) {
        const leagueShortcut = parts[0][0] + 'l'; // first letter + 'l'
        shortcutParts.push(leagueShortcut);
        parts.shift();
    }

    // Abbreviate level for mini leagues
    if (isMini && parts.length > 0 && /^[a-zA-Z]{3,}$/.test(parts[0])) {
        shortcutParts.push(parts[0][0].toLowerCase());
        parts.shift();
    }

    // Remaining parts like 'a', 'b', 'c' (division)
    parts.forEach(part => {
        if (/^[a-zA-Z0-9]+$/.test(part)) {
            shortcutParts.push(part.toLowerCase());
        }
    });

    return shortcutParts.join('-');

}

async function main() {
    console.log("Starting crawl...");
    const berlinVerbandId = 3; // Berlin
    const leagues = await fetchLeagues(berlinVerbandId);
    console.log(`Found ${leagues.length} leagues in Berlin. Searching for BC Lions teams...`);

    const teamsFound = new Map();
    const batchSize = 20;

    for (let i = 0; i < leagues.length; i += batchSize) {
        const batch = leagues.slice(i, i + batchSize);
        const competitionResults = await Promise.all(batch.map(league => fetchCompetition(league.ligaId)));

        batch.forEach((league, index) => {
            if (league.liganame.toLowerCase().includes('pokal')) {
                return; // Skip pokal leagues
            }
            const competition = competitionResults[index];
            if (competition && competition.matches) {
                for (const match of competition.matches) {
                    const team = findTeam(match, TEAM_NAME_TO_SEARCH);
                    if (team && team.teamPermanentId) {
                        const compositeKey = `${team.teamPermanentId}-${league.ligaId}`;
                        if (!teamsFound.has(compositeKey)) {
                            teamsFound.set(compositeKey, {
                                teamName: team.teamname,
                                competitionId: league.ligaId,
                                competitionName: league.liganame,
                            });
                        }
                    }
                }
            }
        });
    }

    const teamsArray = Array.from(teamsFound.values());
    console.log(`Found ${teamsArray.length} BC Lions teams. Creating config files...`);

    teamsArray.forEach(team => {
        const teamId = shortcutForTeamId(sanitizeForFilename(team.competitionName));
        const config = {
            competitionId: team.competitionId,
            teamName: team.teamName,
            teamId: teamId
        };
        const filename = `teams/${teamId}.json`;
        writeFileSync(filename, JSON.stringify(config, null, 2));
        console.log(`Created config file: ${filename}`);
    });

    console.log("Done.");
}

main();