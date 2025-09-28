#!/usr/bin/env node
import { readFileSync } from 'fs';
import { glob } from 'glob';
import { spawn } from 'child_process';

// Check for quiet mode
const isQuiet = process.argv.includes('--quiet');

if (!isQuiet) {
    console.log('Fetching games for all configured teams...\n');
}

// Find all JSON config files in the teams folder
const configFiles = glob.sync('teams/*.json');

if (configFiles.length === 0) {
    console.log('No configuration files found!');
    console.log('Create JSON config files like u11.json, u12.json with the required structure.');
    process.exit(1);
}

if (!isQuiet) {
    console.log(`Found ${configFiles.length} configuration files:`);
    configFiles.forEach(file => {
        try {
            const config = JSON.parse(readFileSync(file, 'utf8'));
            console.log(`  - ${file}: ${config.teamName} (League ${config.competitionId})`);
        } catch (error) {
            console.log(`  - ${file}: Error reading config`);
        }
    });
    console.log('');
}

// Process each config file sequentially
async function processConfigs() {
    for (const configFile of configFiles) {
        if (!isQuiet) {
            console.log(`Processing ${configFile}...`);
        }
        
        try {
            await new Promise((resolve, reject) => {
                const fileName = configFile.replace('teams/', '');
                const args = isQuiet ? ['fetch-games.js', fileName, '--quiet'] : ['fetch-games.js', fileName];
                const child = spawn('node', args, {
                    stdio: isQuiet ? 'pipe' : 'inherit'
                });
                
                let output = '';
                if (isQuiet) {
                    child.stdout.on('data', (data) => output += data);
                    child.stderr.on('data', (data) => output += data);
                }
                
                child.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        if (isQuiet && output) {
                            console.error(output); // Show output on error
                        }
                        reject(new Error(`fetch-games.js failed for ${configFile} with code ${code}`));
                    }
                });
            });
            
            if (!isQuiet) {
                console.log(`✅ Successfully processed ${configFile}\n`);
            }
            
        } catch (error) {
            console.error(`❌ Failed to process ${configFile}: ${error.message}\n`);
        }
    }
    
    if (isQuiet) {
        console.log(`✅ Fetched data for ${configFiles.length} teams`);
    } else {
        console.log('🎉 All configurations processed!');
        console.log('📄 Generated docs/index.html with updated calendar data');
    }
}

processConfigs().catch(error => {
    console.error('Error processing configurations:', error);
    process.exit(1);
});