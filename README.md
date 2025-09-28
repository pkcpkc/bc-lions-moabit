# BC Lions Moabit - Dynamic Calendar System

This system automatically generates basketball team calendars with client-side dynamic rendering. It fetches game data from basketball-bund.net and generates both ICS calendar files and a responsive HTML page with dynamic team sections.

## Architecture

- **Client-Side Rendering**: HTML page dynamically creates team sections using JavaScript
- **Template**: `index.template.html` - Static template with dynamic placeholders
- **Builder**: `build-html.js` - Generates HTML with embedded JSON configuration
- **Fetcher**: `fetch-games.js` - Downloads games and generates ICS files with team prefixes
- **Configurations**: `teams/*.json` files with explicit team IDs

## Configuration Format

Each JSON config file should contain:

```json
{
    "teamId": "u12",
    "competitionId": "50422",
    "teamName": "BC Lions Moabit 1 mix"
}
```

- **teamId**: Unique identifier for the team (used for prefixes and file generation)
- **competitionId**: The ID from the basketball-bund.net website
- **teamName**: The exact team name to filter for

**Note**: ICS filename is automatically generated as `docs/ics/${teamId}.ics`

## Usage

### Complete Build (Recommended)
```bash
# Fetch games for all teams AND generate HTML in one command
npm run build
# or
node build.js
```

This is the **recommended workflow** as it ensures your HTML page always has the latest game data by automatically running both fetch and build operations in sequence.

### Individual Operations
```bash
# Fetch games for all configured teams (without HTML generation)
npm run fetch-all

# Fetch games for a specific team and update HTML
node fetch-games.js u11.json
node fetch-games.js u12.json
node fetch-games.js u15.json    # Works with any team config file

# Generate HTML only (with current data)
npm run build-html
# or
node build-html.js
```

## How It Works

### Server-Side (Build Time)
1. **build-html.js** scans `teams/*.json` files and embeds their configuration as JSON in the HTML template
2. **fetch-games.js** fetches games from basketball-bund.net API and generates ICS files with team ID prefixes (e.g., `u11: Team A vs Team B`)

### Client-Side (Runtime) 
3. JavaScript dynamically creates:
   - Navigation links for each team (alphabetically sorted)
   - Calendar sections with download/subscribe buttons  
   - Event previews loaded from ICS files
4. Static Jugendfahrplan section remains unchanged

## Key Features

### Team ID Prefixes in Calendar Entries
All calendar entries are prefixed with the team ID for easy identification:
- `u11: BC Lions Moabit 1 mix vs Team X (Venue)`
- `u12: Team Y vs BC Lions Moabit 1 mix (Venue)`

### Dynamic Team Sections
Teams are automatically sorted alphabetically and rendered client-side, making it easy to add new teams without template changes.

### Automatic File Generation
- ICS files: `docs/ics/${teamId}.ics`
- Team names: `Spielplan ${teamId.toUpperCase()}`
- Navigation IDs: `spielplan_${teamId}`

## Adding New Teams

1. Create a new JSON config file in the teams folder (e.g., `teams/u15.json`):
   ```json
   {
       "teamId": "u15",
       "competitionId": "12345",
       "teamName": "BC Lions Moabit 1 mix"
   }
   ```
2. Run `node fetch-games.js u15.json`
3. The team will automatically appear in the HTML (sorted alphabetically)

## Template System

The template uses client-side JavaScript generation with one placeholder:

- `{{CALENDAR_CONFIGS}}` - JSON array with team configurations

Dynamic sections are created by JavaScript:
- Team navigation links
- Calendar sections with proper URLs
- Event loading and display

## Project Structure

```
bc-lions-moabit/
├── .github/
│   └── workflows/
│       └── update-calendars.yml  # GitHub Actions automation
├── teams/                    # Team configuration files
│   ├── u11.json             # U11 team config with teamId
│   └── u12.json             # U12 team config with teamId
├── docs/
│   ├── index.html           # Generated main page (client-side rendering)
│   └── ics/                 # Generated calendar files
│       ├── u11.ics          # U11 calendar with "u11:" prefixes
│       ├── u12.ics          # U12 calendar with "u12:" prefixes
│       └── jugendfahrplan.ics
├── index.template.html      # Template for HTML generation
├── build-html.js           # HTML generator with JSON embedding
├── fetch-games.js          # Game fetcher with team prefix support
├── fetch-all.js            # Process all teams at once
├── build.js                # Complete build: fetch all + generate HTML
└── README.md               # This file
```

## Recent Changes

### v2.0 - Client-Side Dynamic Rendering
- **Breaking Change**: Moved from server-side HTML generation to client-side dynamic rendering
- **Removed**: `generateHTML.js` (functionality integrated into `build-html.js`)
- **Config Format**: Added explicit `teamId` field, removed `icsFilename` (auto-generated)
- **Team Prefixes**: All ICS calendar entries now prefixed with team ID (e.g., `u11:`, `u12:`)
- **Alphabetical Sorting**: Teams automatically sorted alphabetically in navigation
- **Simplified Architecture**: Single JSON placeholder in template, JavaScript handles the rest

### Migration from v1.x
If you have old config files, update them:
```json
// Old format:
{
    "competitionId": "50422",
    "teamName": "BC Lions Moabit 1 mix", 
    "icsFilename": "docs/ics/u12.ics"
}

// New format:
{
    "teamId": "u12",
    "competitionId": "50422",
    "teamName": "BC Lions Moabit 1 mix"
}
```

## Automation

### GitHub Actions
The repository includes a GitHub Actions workflow that automatically:
- Runs daily at 6:00 AM UTC (8:00 AM CET)
- Fetches latest game data for all teams
- Updates HTML and ICS files
- Commits and pushes changes if data has been updated

**Manual Triggers:**
- Push to main branch (when config files or build scripts change)
- Manual workflow dispatch from GitHub UI (Actions tab)

**Workflow file:** `.github/workflows/update-calendars.yml`

**Note:** The workflow uses the default `GITHUB_TOKEN` with write permissions to commit changes. No additional setup required.

This ensures your basketball calendars stay up-to-date automatically without manual intervention.

## Dependencies

- `node-fetch` - For API requests
- `glob` - For finding configuration files

Install with: `npm install`