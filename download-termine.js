#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import fetch from 'node-fetch';

/**
 * Downloads ICS files for termine from Google Calendar
 */
async function downloadTermineIcsFiles(quiet = false) {
    if (!quiet) {
        console.log('🗓️  Downloading ICS files for termine...');
    }

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

    if (!quiet) {
        console.log(`Found ${scheduleConfigs.length} schedule configurations`);
    }

    let downloadedCount = 0;
    let errorCount = 0;

    for (const config of scheduleConfigs) {
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
            
            if (!quiet) {
                console.log(`  ✅ Downloaded: ${config.label} -> ${icsFilename}`);
            }
        } catch (error) {
            errorCount++;
            console.warn(`  ❌ Error downloading ICS for ${config.label}:`, error.message);
        }
    }

    if (!quiet) {
        console.log(`📥 Downloaded ${downloadedCount} ICS files (${errorCount} errors)`);
    }

    return { downloadedCount, errorCount, totalConfigs: scheduleConfigs.length };
}

// Run the function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const isQuiet = process.argv.includes('--quiet');
    
    try {
        const result = await downloadTermineIcsFiles(isQuiet);
        
        if (!isQuiet) {
            console.log('✅ Termine ICS download completed successfully!');
        }
        
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