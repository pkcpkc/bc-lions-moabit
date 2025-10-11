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
            let teamCategory = config.teamId.toUpperCase();
            
            // Convert M or W prefix to lowercase for display
            if (teamCategory.startsWith('M') || teamCategory.startsWith('W')) {
                teamCategory = teamCategory.charAt(0).toLowerCase() + teamCategory.slice(1);
            }
            
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

    // Find all JSON config files in the schedule folder
    const scheduleFiles = glob.sync('schedule/*.json');
    const scheduleConfigs = [];

    // Process each schedule config file
    scheduleFiles.forEach(scheduleFile => {
        try {
            const scheduleContent = readFileSync(scheduleFile, 'utf8');
            const scheduleConfig = JSON.parse(scheduleContent);
            
            // Validate required config fields
            if (!scheduleConfig.label || !scheduleConfig.calId) {
                console.warn(`Skipping ${scheduleFile}: Missing required fields (label, calId)`);
                return;
            }

            // Generate id from filename
            const id = scheduleFile.replace('schedule/', '').replace('.json', '');
            
            // Add to schedule configs array
            const configData = {
                id: id,
                label: scheduleConfig.label,
                calId: scheduleConfig.calId
            };
            
            scheduleConfigs.push(configData);

        } catch (error) {
            console.warn(`Error processing ${scheduleFile}:`, error.message);
        }
    });

    // Sort schedules alphabetically by label name
    scheduleConfigs.sort((a, b) => a.label.localeCompare(b.label));

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
        .replace(/\{\{\s*SCHEDULE_CONFIGS\s*\}\}/g, JSON.stringify(scheduleConfigs, null, 8))
        .replace(/\{\{\s*LAST_UPDATED\s*\}\}/g, berlinTime);

    // Write the generated HTML
    writeFileSync('docs/index.html', html);
    
    if (!quiet) {
        console.log(`Generated docs/index.html with ${configs.length} calendar configurations and ${scheduleConfigs.length} schedule configurations`);
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