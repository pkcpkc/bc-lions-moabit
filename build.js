#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Runs a Node.js script and returns a Promise
 */
function runScript(scriptName, args = [], quiet = false) {
    return new Promise((resolve, reject) => {
        if (!quiet) {
            console.log(`🚀 Running: node ${scriptName} ${args.join(' ')}`);
        }
        
        const scriptPath = join(__dirname, scriptName);
        const allArgs = quiet ? [...args, '--quiet'] : args;
        const child = spawn('node', [scriptPath, ...allArgs], {
            stdio: quiet ? 'pipe' : 'inherit',
            cwd: __dirname
        });

        let output = '';
        if (quiet) {
            child.stdout.on('data', (data) => output += data);
            child.stderr.on('data', (data) => output += data);
        }

        child.on('close', (code) => {
            if (code !== 0) {
                if (quiet && output) {
                    console.error(output); // Show output on error even in quiet mode
                }
                reject(new Error(`Script ${scriptName} exited with code ${code}`));
            } else {
                if (!quiet) {
                    console.log(`✅ Completed: ${scriptName}\n`);
                }
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
    // Check for quiet mode (for automated builds)
    const isQuiet = process.argv.includes('--quiet');
    
    if (!isQuiet) {
        console.log('🏀 BC Lions Moabit - Build All');
        console.log('==============================\n');
    }

    try {
        // Step 1: Fetch games for all configured teams
        if (!isQuiet) {
            console.log('📥 Step 1: Fetching games for all teams...');
        }
        await runScript('fetch-all.js', [], isQuiet);

        // Step 2: Download termine ICS files
        if (!isQuiet) {
            console.log('🗓️  Step 2: Downloading termine ICS files...');
        }
        await runScript('download-termine.js', [], isQuiet);

        // Step 3: Generate HTML with updated data
        if (!isQuiet) {
            console.log('🔨 Step 3: Building HTML with fresh data...');
        }
        await runScript('build-html.js', [], isQuiet);

        if (isQuiet) {
            console.log('✅ Build completed - calendars updated');
        } else {
            console.log('🎉 Build all completed successfully!');
            console.log('📄 Generated docs/index.html with latest game data');
        }

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