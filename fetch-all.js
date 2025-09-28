#!/usr/bin/env node
import { readFileSync } from 'fs';
import { glob } from 'glob';
import { spawn } from 'child_process';

console.log('Fetching games for all configured teams...\n');

// Find all JSON config files in the teams folder
const configFiles = glob.sync('teams/*.json');

if (configFiles.length === 0) {
    console.log('No configuration files found!');
    console.log('Create JSON config files like u11.json, u12.json with the required structure.');
    process.exit(1);
}

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

// Process each config file sequentially
async function processConfigs() {
    for (const configFile of configFiles) {
        console.log(`Processing ${configFile}...`);
        
        try {
            await new Promise((resolve, reject) => {
                const fileName = configFile.replace('teams/', '');
                const child = spawn('node', ['fetch-games.js', fileName], {
                    stdio: 'inherit'
                });
                
                child.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`fetch-games.js failed for ${configFile} with code ${code}`));
                    }
                });
            });
            
            console.log(`✅ Successfully processed ${configFile}\n`);
            
        } catch (error) {
            console.error(`❌ Failed to process ${configFile}: ${error.message}\n`);
        }
    }
    
    console.log('🎉 All configurations processed!');
    console.log('📄 Generated docs/index.html with updated calendar data');
}

processConfigs().catch(error => {
    console.error('Error processing configurations:', error);
    process.exit(1);
});