import fetch from 'node-fetch';

export class CrawlService {
    constructor(httpClient, teamDiscoveryService, logger = console) {
        this.httpClient = httpClient;
        this.teamDiscoveryService = teamDiscoveryService;
        this.logger = logger;
        this.apiUrl = "https://www.basketball-bund.net/rest/wam/liga/list";
        this.competitionUrl = "https://www.basketball-bund.net/rest/competition/spielplan/id";
    }

    async fetchLeagues(verbandId) {
        let allLeagues = [];
        let startAtIndex = 0;
        let hasMoreData = true;

        this.logger.debug(`Fetching leagues for verband ${verbandId}`);

        while (hasMoreData) {
            try {
                const url = `${this.apiUrl}?startAtIndex=${startAtIndex}`;
                const requestBody = JSON.stringify({ 
                    "wam": { "verbandIds": [verbandId] } 
                });

                // Use direct fetch since we need POST with body
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: requestBody
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                const { ligen, hasMoreData: moreData } = data.data;
                allLeagues = allLeagues.concat(ligen);
                hasMoreData = moreData;
                startAtIndex += ligen.length;

                this.logger.debug(`Fetched ${ligen.length} leagues, total: ${allLeagues.length}`);

            } catch (error) {
                this.logger.error(`Failed to fetch leagues for verband ${verbandId}:`, error.message);
                throw error;
            }
        }

        return allLeagues;
    }

    async fetchCompetition(leagueId) {
        try {
            const response = await fetch(`${this.competitionUrl}/${leagueId}`);
            
            if (!response.ok) {
                // A 404 is okay here, it just means the league has no schedule yet
                if (response.status === 404) {
                    this.logger.debug(`League ${leagueId} has no schedule yet (404)`);
                    return null;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data.data;
        } catch (error) {
            this.logger.warn(`Competition fetch failed for league ${leagueId}:`, error.message);
            throw error;
        }
    }

    async investigateLeague(league, teamNameToSearch, index, total) {
        const leagueName = league.liganame;
        
        // Skip pokal and testspiele leagues
        if (this.teamDiscoveryService.shouldSkipLeague(leagueName)) {
            this.logger.debug(`Skipping league: ${leagueName}`);
            return [];
        }

        try {
            const competition = await this.fetchCompetition(league.ligaId);
            const teams = [];
            
            if (competition && competition.matches) {
                for (const match of competition.matches) {
                    const team = this.teamDiscoveryService.findTeam(match, teamNameToSearch);
                    if (team && team.teamPermanentId) {
                        teams.push({
                            teamName: team.teamname,
                            competitionId: league.ligaId,
                            competitionName: league.liganame,
                            teamPermanentId: team.teamPermanentId
                        });
                    }
                }
            }
            
            // Progress reporting
            if ((index + 1) % 50 === 0 || index + 1 === total) {
                this.logger.info(`Processed ${index + 1}/${total} leagues...`);
            }
            
            return teams;
        } catch (error) {
            this.logger.warn(`Failed to process league ${leagueName} (ID: ${league.ligaId}):`, error.message);
            return [];
        }
    }

    async discoverTeams(verbandId, teamNameToSearch) {
        this.logger.info(`Starting team discovery for "${teamNameToSearch}" in verband ${verbandId}`);
        
        // Fetch all leagues
        this.logger.info("📥 Fetching all leagues...");
        const leagues = await this.fetchLeagues(verbandId);
        this.logger.info(`📋 Found ${leagues.length} leagues`);
        
        // Investigate all leagues in parallel
        this.logger.info("🔍 Investigating all leagues for teams...");
        const startTime = Date.now();
        
        const investigationPromises = leagues.map((league, index) => 
            this.investigateLeague(league, teamNameToSearch, index, leagues.length)
        );
        
        const allTeamResults = await Promise.all(investigationPromises);
        
        // Remove duplicates and flatten results
        const uniqueTeams = this.teamDiscoveryService.removeDuplicateTeams(allTeamResults);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        this.logger.info(`✅ Investigation complete in ${duration}s. Found ${uniqueTeams.length} teams.`);
        
        return uniqueTeams;
    }
}