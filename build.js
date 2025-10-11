#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Runs a Node.js script and returns a Promise
 */
function runScript(scriptName, args = []) {
    return new Promise((resolve, reject) => {
        console.log(`🚀 Running: node ${scriptName} ${args.join(' ')}`);
        
        const scriptPath = join(__dirname, scriptName);
        const child = spawn('node', [scriptPath, ...args], {
            stdio: 'inherit',
            cwd: __dirname
        });

        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Script ${scriptName} exited with code ${code}`));
            } else {
                console.log(`✅ Completed: ${scriptName}\n`);
                resolve();
            }
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

/**
 * Build all: fetch games for all teams, then generate HTML
 */
async function buildAll() {
    console.log('🏀 BC Lions Moabit - Build All');
    console.log('==============================\n');

    try {
        // Step 1: Fetch games for all configured teams
        console.log('📥 Step 1: Fetching games for all teams...');
        await runScript('fetch-all.js', []);

        // Step 2: Download termine ICS files
        console.log('🗓️  Step 2: Downloading termine ICS files...');
        await runScript('download-termine.js', []);

        // Step 3: Generate HTML with updated data
        console.log('🔨 Step 3: Building HTML with fresh data...');
        await runScript('build-html.js', []);

        console.log('🎉 Build all completed successfully!');
        console.log('📄 Generated docs/index.html with latest game data');

    } catch (error) {
        console.error('❌ Build failed:', error.message);
        process.exit(1);
    }
}

// Run build-all if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    buildAll();
}

// Export for potential use by other modules
export { buildAll };