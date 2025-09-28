#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

/**
 * Generates the index.html file dynamically based on available config files
 */
function generateIndexHTML() {
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
                name: `Spielplan ${teamCategory}`,
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

    // Read the template
    const template = readFileSync('index.template.html', 'utf8');

    // Replace only the JSON configuration data
    let html = template
        .replace('{{CALENDAR_CONFIGS}}', JSON.stringify(configs, null, 8));

    // Write the generated HTML
    writeFileSync('docs/index.html', html);
    
    console.log(`Generated docs/index.html with ${configs.length} calendar configurations`);
    
    return configs;
}

// Export the function for use by other modules
export { generateIndexHTML };

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