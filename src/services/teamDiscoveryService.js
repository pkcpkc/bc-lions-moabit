export class TeamDiscoveryService {
    constructor(logger = console) {
        this.logger = logger;
    }

    findTeam(match, teamName) {
        const searchName = teamName.toLowerCase();

        if (match.homeTeam && match.homeTeam.teamname.toLowerCase().startsWith(searchName)) {
            return match.homeTeam;
        }
        if (match.guestTeam && match.guestTeam.teamname.toLowerCase().startsWith(searchName)) {
            return match.guestTeam;
        }
        return null;
    }

    sanitizeForFilename(name) {
        const sanitized = name.toLowerCase()
            .replace(/ä/g, 'ae')
            .replace(/ö/g, 'oe')
            .replace(/ü/g, 'ue')
            .replace(/ß/g, 'ss')
            .replace(/rueckrunde/g, 'rr');
        return sanitized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    generateTeamId(competitionName) {
        let shortcut = this.sanitizeForFilename(competitionName);
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
            // For pokal competitions, ignore remaining parts like "herren", "damen"
            return shortcutParts.join('-');
        } else if (parts[0] === 'pokal') {
            shortcutParts.push('pokal');
            parts.shift();
            // For pokal competitions, ignore remaining parts like "herren", "damen"
            return shortcutParts.join('-');
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

    createTeamConfig(team, competitionId, competitionName) {
        const teamId = this.generateTeamId(competitionName);

        return {
            competitionId: competitionId,
            teamName: team.teamname,
            teamId: teamId
        };
    }

    removeDuplicateTeams(teamResults) {
        const teamsFound = new Map();

        for (const teamArray of teamResults) {
            for (const team of teamArray) {
                const compositeKey = `${team.teamPermanentId}-${team.competitionId}`;
                if (!teamsFound.has(compositeKey)) {
                    teamsFound.set(compositeKey, {
                        teamName: team.teamName,
                        competitionId: team.competitionId,
                        competitionName: team.competitionName,
                        teamPermanentId: team.teamPermanentId
                    });
                }
            }
        }

        return Array.from(teamsFound.values());
    }

    shouldSkipLeague(leagueName) {
        const lowercaseName = leagueName.toLowerCase();
        return lowercaseName.includes('pokal') || lowercaseName.includes('testspiele');
    }
}