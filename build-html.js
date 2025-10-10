#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

/**
 * Generates the index.html file with embedded calendar configurations
 */
export function generateIndexHTML(quiet = false) {
    // Find all JSON config files in the teams folder
    const configFiles = glob.sync('teams/*.json');

    const configs = [];

    // Process each config file
    configFiles.forEach(configFile => {
        try {
            const configContent = readFileSync(configFile, 'utf8');
            const config = JSON.parse(configContent);
            
            // Validate required config fields
            if (!config.competitionId || !config.teamName || !config.teamId) {
                console.warn(`Skipping ${configFile}: Missing required fields (competitionId, teamName, teamId)`);
                return;
            }

            // Use teamId from config and generate ICS filename
            const teamCategory = config.teamId.toUpperCase();
            const id = config.teamId;
            const icsFilename = `docs/ics/${config.teamId}.ics`;
            
            // Add to configs array
            const configData = {
                id: id,
                name: `${teamCategory}`,
                competitionId: config.competitionId,
                teamName: config.teamName,
                icsFilename: icsFilename,
                icsUrl: `https://pkcpkc.github.io/bc-lions-moabit/ics/${config.teamId}.ics`,
                webUrl: `https://www.basketball-bund.net/static/#/liga/${config.competitionId}`
            };
            
            configs.push(configData);

        } catch (error) {
            console.warn(`Error processing ${configFile}:`, error.message);
        }
    });

    // Sort teams alphabetically by name
    configs.sort((a, b) => a.name.localeCompare(b.name));

    // Find all JSON config files in the trainings folder
    const trainingFiles = glob.sync('trainings/*.json');
    const trainingConfigs = [];

    // Process each training config file
    trainingFiles.forEach(trainingFile => {
        try {
            const trainingContent = readFileSync(trainingFile, 'utf8');
            const trainingConfig = JSON.parse(trainingContent);
            
            // Validate required config fields
            if (!trainingConfig.team || !trainingConfig.calId) {
                console.warn(`Skipping ${trainingFile}: Missing required fields (team, calId)`);
                return;
            }

            // Generate id from filename
            const id = trainingFile.replace('trainings/', '').replace('.json', '');
            
            // Add to training configs array
            const configData = {
                id: id,
                team: trainingConfig.team,
                calId: trainingConfig.calId
            };
            
            trainingConfigs.push(configData);

        } catch (error) {
            console.warn(`Error processing ${trainingFile}:`, error.message);
        }
    });

    // Sort trainings alphabetically by team name
    trainingConfigs.sort((a, b) => a.team.localeCompare(b.team));

    // Read the template
    const template = readFileSync('index.template.html', 'utf8');

    // Generate Berlin time timestamp
    const now = new Date();
    const berlinTime = now.toLocaleString('de-DE', {
        timeZone: 'Europe/Berlin',
        dateStyle: 'full',
        timeStyle: 'short'
    });

    // Replace placeholders (handle both with and without spaces)
    let html = template
        .replace(/\{\{\s*CALENDAR_CONFIGS\s*\}\}/g, JSON.stringify(configs, null, 8))
        .replace(/\{\{\s*TRAINING_CONFIGS\s*\}\}/g, JSON.stringify(trainingConfigs, null, 8))
        .replace(/\{\{\s*LAST_UPDATED\s*\}\}/g, berlinTime);

    // Write the generated HTML
    writeFileSync('docs/index.html', html);
    
    if (!quiet) {
        console.log(`Generated docs/index.html with ${configs.length} calendar configurations and ${trainingConfigs.length} training configurations`);
    }
    
    return configs;
}

// Run the function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const isQuiet = process.argv.includes('--quiet');
  
  if (!isQuiet) {
    console.log('Generating index.html from available configurations...');
  }
  
  try {
    generateIndexHTML(isQuiet);
    
    if (!isQuiet) {
      console.log('HTML generation completed successfully!');
    }
  } catch (error) {
    console.error('Error generating HTML:', error);
    process.exit(1);
  }
}