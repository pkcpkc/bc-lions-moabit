#!/usr/bin/env node
import fetch from 'node-fetch';
import { writeFileSync } from 'fs';

const TEAM_NAME_TO_SEARCH = "BC Lions Moabit";

const API_URL = "https://www.basketball-bund.net/rest/wam/liga/list";
const COMPETITION_URL = "https://www.basketball-bund.net/rest/competition/spielplan/id";



async function fetchWithRetry(url, options, retries = 3, delay = 500) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (error) {
            if (i < retries - 1) {
                console.warn(`    Retry ${i + 1}/${retries} for ${url.split('/').pop()}`);
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
            } else {
                throw new Error(`Network error after ${retries} retries: ${error.message}`);
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
    try {
        const response = await fetchWithRetry(`${COMPETITION_URL}/${leagueId}`);
        if (!response.ok) {
            // A 404 is okay here, it just means the league has no schedule yet
            if (response.status === 404) {
                return null;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        return data.data;
    } catch (error) {
        // Re-throw with more context for debugging
        throw new Error(`Competition fetch failed: ${error.message}`);
    }
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

async function investigateLeague(league, index, total) {
    const leagueName = league.liganame.toLowerCase();
    if (leagueName.includes('pokal') || leagueName.includes('testspiele')) {
        return []; // Skip pokal and testspiele leagues
    }

    try {
        const competition = await fetchCompetition(league.ligaId);
        const teams = [];
        
        if (competition && competition.matches) {
            for (const match of competition.matches) {
                const team = findTeam(match, TEAM_NAME_TO_SEARCH);
                if (team && team.teamPermanentId) {
                    const compositeKey = `${team.teamPermanentId}-${league.ligaId}`;
                    teams.push({
                        compositeKey,
                        teamName: team.teamname,
                        competitionId: league.ligaId,
                        competitionName: league.liganame,
                    });
                }
            }
        }
        
        // Progress reporting
        if ((index + 1) % 50 === 0 || index + 1 === total) {
            console.log(`  Processed ${index + 1}/${total} leagues...`);
        }
        
        return teams;
    } catch (error) {
        console.warn(`  Warning: Failed to process league ${league.liganame} (ID: ${league.ligaId}): ${error.message}`);
        return [];
    }
}

async function main() {
    console.log("🏀 Starting BC Lions team discovery crawl...");
    const berlinVerbandId = 3; // Berlin
    
    console.log("📥 Fetching all Berlin leagues...");
    const leagues = await fetchLeagues(berlinVerbandId);
    console.log(`📋 Found ${leagues.length} leagues in Berlin`);
    console.log("🔍 Investigating all leagues in parallel for BC Lions teams...");
    const startTime = Date.now();
    
    // Create promises for all league investigations
    const investigationPromises = leagues.map((league, index) => 
        investigateLeague(league, index, leagues.length)
    );
    
    // Wait for all investigations to complete
    const allTeamResults = await Promise.all(investigationPromises);
    
    // Flatten results and remove duplicates
    const teamsFound = new Map();
    for (const teamArray of allTeamResults) {
        for (const team of teamArray) {
            if (!teamsFound.has(team.compositeKey)) {
                teamsFound.set(team.compositeKey, {
                    teamName: team.teamName,
                    competitionId: team.competitionId,
                    competitionName: team.competitionName,
                });
            }
        }
    }

    const teamsArray = Array.from(teamsFound.values());
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`✅ Investigation complete in ${duration}s. Found ${teamsArray.length} BC Lions teams.`);

    if (teamsArray.length === 0) {
        console.log("⚠️  No BC Lions teams found. Exiting without creating files.");
        return;
    }

    console.log("📝 Creating configuration files...");
    let createdFiles = 0;
    let skippedFiles = 0;

    teamsArray.forEach(team => {
        const teamId = shortcutForTeamId(sanitizeForFilename(team.competitionName));
        const config = {
            competitionId: team.competitionId,
            teamName: team.teamName,
            teamId: teamId
        };
        const filename = `teams/${teamId}.json`;
        
        try {
            writeFileSync(filename, JSON.stringify(config, null, 2));
            console.log(`  ✅ Created: ${filename} (${team.teamName})`);
            createdFiles++;
        } catch (error) {
            console.error(`  ❌ Failed to create ${filename}: ${error.message}`);
            skippedFiles++;
        }
    });

    console.log(`🎉 Crawl completed successfully!`);
    console.log(`📊 Summary: ${createdFiles} files created, ${skippedFiles} errors`);
}

main();