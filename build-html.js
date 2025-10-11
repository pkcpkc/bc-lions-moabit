#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

/**
 * Generates the index.html file with embedded calendar configurations
 */
export function generateIndexHTML() {
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
            let teamCategory = config.teamId.toUpperCase();
            
            // Convert M or W prefix to lowercase for display
            if (teamCategory.startsWith('M') || teamCategory.startsWith('W')) {
                teamCategory = teamCategory.charAt(0).toLowerCase() + teamCategory.slice(1);
            }
            
            const id = config.teamId;
            const icsFilename = `docs/ics/spiele/${config.teamId}.ics`;
            
            // Add to configs array
            const configData = {
                id: id,
                name: `${teamCategory}`,
                competitionId: config.competitionId,
                teamName: config.teamName,
                icsFilename: icsFilename,
                icsUrl: `https://pkcpkc.github.io/bc-lions-moabit/ics/spiele/${config.teamId}.ics`,
                webUrl: `https://www.basketball-bund.net/static/#/liga/${config.competitionId}`
            };
            
            configs.push(configData);

        } catch (error) {
            console.warn(`Error processing ${configFile}:`, error.message);
        }
    });

    // Sort teams alphabetically by name
    configs.sort((a, b) => a.name.localeCompare(b.name));

    // Find all JSON config files in the termine folder
    const termineFiles = glob.sync('termine/*.json');
    const termineConfigs = [];

    // Process each termine config file
    termineFiles.forEach(termineFile => {
        try {
            const termineContent = readFileSync(termineFile, 'utf8');
            const termineConfig = JSON.parse(termineContent);
            
            // Validate required config fields
            if (!termineConfig.label || !termineConfig.calId) {
                console.warn(`Skipping ${termineFile}: Missing required fields (label, calId)`);
                return;
            }

            // Generate id from filename
            const id = termineFile.replace('termine/', '').replace('.json', '');
            
            // Add to termine configs array
            const configData = {
                id: id,
                label: termineConfig.label,
                calId: termineConfig.calId
            };
            
            termineConfigs.push(configData);

        } catch (error) {
            console.warn(`Error processing ${termineFile}:`, error.message);
        }
    });

    // Sort termine alphabetically by label name
    termineConfigs.sort((a, b) => a.label.localeCompare(b.label));

    // Update termine configs with ICS file paths (files should be downloaded separately)
    termineConfigs.forEach(config => {
        config.icsFilename = `docs/ics/termine/${config.id}.ics`;
        config.icsUrl = `https://pkcpkc.github.io/bc-lions-moabit/ics/termine/${config.id}.ics`;
    });

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
        .replace(/\{\{\s*SCHEDULE_CONFIGS\s*\}\}/g, JSON.stringify(termineConfigs, null, 8))
        .replace(/\{\{\s*LAST_UPDATED\s*\}\}/g, berlinTime);

    // Write the generated HTML
    writeFileSync('docs/index.html', html);
    
    console.log(`Generated docs/index.html with ${configs.length} calendar configurations and ${termineConfigs.length} termine configurations`);
    
    return configs;
}

// Run the function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Generating index.html from available configurations...');
  
  try {
    generateIndexHTML();
    
    console.log('HTML generation completed successfully!');
  } catch (error) {
    console.error('Error generating HTML:', error);
    process.exit(1);
  }
}