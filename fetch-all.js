#!/usr/bin/env node
import { readFileSync } from 'fs';
import { glob } from 'glob';
import { spawn } from 'child_process';

console.log('🏀 BC Lions Moabit - Fetch All Teams');
console.log('===================================\n');
console.log('Fetching games for all configured teams in parallel...\n');

// Find all JSON config files in the teams folder
const configFiles = glob.sync('teams/*.json');

if (configFiles.length === 0) {
    console.log('No configuration files found!');
    console.log('Create JSON config files like u11.json, u12.json with the required structure.');
    process.exit(1);
}

console.log(`📋 Found ${configFiles.length} team configuration files:`);
configFiles.forEach(file => {
    try {
        const config = JSON.parse(readFileSync(file, 'utf8'));
        console.log(`  - ${file.replace('teams/', '')}: ${config.teamName} (League ${config.competitionId})`);
    } catch (error) {
        console.log(`  - ${file.replace('teams/', '')}: ❌ Error reading config - ${error.message}`);
    }
});
console.log('');

// Process a single config file
async function processConfig(configFile, index, total) {
    const fileName = configFile.replace('teams/', '');
    const args = ['fetch-games.js', fileName];
    
    return new Promise((resolve, reject) => {
        const child = spawn('node', args, {
            stdio: 'pipe'
        });
        
        let output = '';
        let errorOutput = '';
        
        child.stdout.on('data', (data) => output += data);
        child.stderr.on('data', (data) => errorOutput += data);
        
        child.on('close', (code) => {
            if (code === 0) {
                // Extract game count from output
                const gameMatch = output.match(/Found (\d+) games for (.+)\./);
                const progressInfo = gameMatch ? `${gameMatch[1]} games for ${gameMatch[2]}` : 'Completed';
                
                console.log(`✅ [${index + 1}/${total}] ${fileName} - ${progressInfo}`);
                resolve({ configFile, success: true, output: progressInfo });
            } else {
                const error = errorOutput.trim() || output.trim() || `Exit code ${code}`;
                console.error(`❌ [${index + 1}/${total}] ${fileName} - ${error}`);
                resolve({ configFile, success: false, error }); // Resolve instead of reject to continue processing others
            }
        });
        
        child.on('error', (error) => {
            console.error(`❌ [${index + 1}/${total}] ${fileName} - Spawn error: ${error.message}`);
            resolve({ configFile, success: false, error: error.message });
        });
    });
}

// Process all config files in parallel
async function processConfigs() {
    console.log(`🚀 Processing ${configFiles.length} teams in parallel...\n`);
    
    const startTime = Date.now();
    
    // Create promises for all teams
    const promises = configFiles.map((configFile, index) => 
        processConfig(configFile, index, configFiles.length)
    );
    
    // Wait for all to complete
    const results = await Promise.all(promises);
    
    // Collect statistics
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Calculate total games
    const totalGames = successful.reduce((sum, result) => {
        const gameMatch = result.output.match(/(\d+) games/);
        return sum + (gameMatch ? parseInt(gameMatch[1]) : 0);
    }, 0);
    
    console.log(`\n🎉 Parallel processing completed in ${duration}s!`);
    console.log(`📊 Results: ${successful.length} successful, ${failed.length} failed`);
    if (totalGames > 0) {
        console.log(`📈 Total games processed: ${totalGames}`);
    }
    
    if (failed.length > 0) {
        console.log(`\n❌ Failed teams:`);
        failed.forEach(result => {
            console.log(`  - ${result.configFile}: ${result.error}`);
        });
    }
    
    // Exit with error code if any teams failed
    if (failed.length > 0) {
        process.exit(1);
    }
}

processConfigs().catch(error => {
    console.error('Error processing configurations:', error);
    process.exit(1);
});