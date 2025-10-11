#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import fetch from 'node-fetch';

/**
 * Downloads ICS files for termine from Google Calendar
 */
async function downloadTermineIcsFiles() {
    console.log('🗓️  Downloading ICS files for termine...');

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

    console.log(`Found ${termineConfigs.length} termine configurations`);

    let downloadedCount = 0;
    let errorCount = 0;

    for (const config of termineConfigs) {
        try {
            const icsUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(config.calId)}/public/basic.ics`;
            const response = await fetch(icsUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const icsContent = await response.text();
            const icsFilename = `docs/ics/termine/${config.id}.ics`;
            
            writeFileSync(icsFilename, icsContent);
            downloadedCount++;
            
            console.log(`  ✅ Downloaded: ${config.label} -> ${icsFilename}`);
        } catch (error) {
            errorCount++;
            console.warn(`  ❌ Error downloading ICS for ${config.label}:`, error.message);
        }
    }

    console.log(`📥 Downloaded ${downloadedCount} ICS files (${errorCount} errors)`);

    return { downloadedCount, errorCount, totalConfigs: termineConfigs.length };
}

// Run the function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        const result = await downloadTermineIcsFiles();
        
        console.log('✅ Termine ICS download completed successfully!');
        
        // Exit with error code if there were any failures
        if (result.errorCount > 0) {
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Error downloading termine ICS files:', error);
        process.exit(1);
    }
}

export { downloadTermineIcsFiles };