import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPIELE_DIR = path.resolve(__dirname, '../../spiele');
const TRAINING_DIR = path.resolve(__dirname, '../../training');

const TRAINING_GROUPS = {
    'Herren.json': /^he-/,
    'Damen.json': /^da-/,
    'mU14-mU20.json': /^mu(14|16|18|20)-/,
    'wU12-wU18.json': /^wu(12|14|16|18)-/,
    'U11-U12.json': /^(mu12-|u11-)/,
    'U6-U10.json': /^u([0-9]|10)-/
};

async function matchTeams() {
    try {
        // Read all team IDs from spiele directory
        const spieleFiles = await fs.readdir(SPIELE_DIR);
        const teamIds = spieleFiles
            .filter(file => file.endsWith('.json'))
            .map(file => path.basename(file, '.json'));

        console.log(`Found ${teamIds.length} teams in ${SPIELE_DIR}`);

        // Read all training files
        const trainingFiles = Object.keys(TRAINING_GROUPS);

        for (const trainingFile of trainingFiles) {
            const filePath = path.join(TRAINING_DIR, trainingFile);
            const matcher = TRAINING_GROUPS[trainingFile];

            let fileContent;
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                fileContent = JSON.parse(content);
            } catch (err) {
                console.warn(`Could not read or parse ${trainingFile}, skipping...`);
                continue;
            }

            // Reset teams array to ensure we only have current matches
            fileContent.teams = [];

            let addedCount = 0;
            const existingTeams = new Set();

            for (const teamId of teamIds) {
                if (matcher.test(teamId)) {
                    if (!existingTeams.has(teamId)) {
                        fileContent.teams.push(teamId);
                        existingTeams.add(teamId); // Prevent duplicates in this run if any
                        addedCount++;
                        console.log(`Added ${teamId} to ${trainingFile}`);
                    }
                }
            }

            if (addedCount > 0) {
                // Sort teams alphabetically for consistency
                fileContent.teams.sort();
                await fs.writeFile(filePath, JSON.stringify(fileContent, null, 4), 'utf-8');
                console.log(`Updated ${trainingFile} with ${addedCount} new teams.`);
            } else {
                console.log(`No changes for ${trainingFile}.`);
            }
        }

    } catch (error) {
        console.error('Error matching teams:', error);
        process.exit(1);
    }
}

matchTeams();
