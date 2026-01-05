# BC Lions Moabit Calendar System

Automated basketball team calendar system that generates dynamic game schedules and training calendars for BC Lions Moabit basketball club.

## Data Flow

```mermaid
flowchart TB
    subgraph INPUT [Data Sources]
        API[Basketball-Bund API<br/>Game data for 22 teams]
        GCL[Google Calendar<br/>7 training schedules]
        CFG[JSON Config Files<br/>teams/, training/, termine/]
    end
    
    subgraph TRANSFORM [Processing]
        FETCH[Fetch & Parse Data<br/>HTTP + ICS parsing]
        PROC[Transform Data<br/>Extract games, results, schedules]
        GEN[Generate Files<br/>ICS calendars + JSON data]
    end
    
    subgraph OUTPUT [Generated Output]
        ICS[ICS Calendar Files<br/>docs/ics/spiele/ + docs/ics/termine/]
        JSON[JSON Data Files<br/>docs/data/spiele/ + docs/data/termine/]
        HTML[Static Website<br/>docs/index.html + JavaScript app]
    end
    
    API --> FETCH
    GCL --> FETCH
    CFG --> FETCH
    
    FETCH --> PROC
    PROC --> GEN
    
    GEN --> ICS
    GEN --> JSON
    GEN --> HTML
    
    HTML --> DEPLOY[GitHub Pages<br/>Live Website]
```

## Tech Stack

- **Runtime:** Node.js 18+ (ES Modules)
- **APIs:** Basketball-Bund REST API, Google Calendar API  
- **Testing:** Vitest (279 tests, 100% pass required)
- **Architecture:** Service-oriented with dependency injection
- **Output:** Static HTML + ICS files + JSON data

## Team Management Workflows

### 1. Crawl for New Teams
Fetch the latest team data from the external source (Basketball Bund). This creates or updates team configuration files in `spiele/`.

```bash
npm run crawl
```
*Optional arguments:*
- `--verbandId <id>`: Filter by association ID (Default: 3 for Berlin)
- `--teamNameToSearch <name>`: Filter by team name (Default: "BC Lions")
- `--outputDir <dir>`: Directory to save files (Default: "spiele")

### 2. Associate Teams to Trainings
Link the discovered teams to their respective training groups based on team ID patterns. This updates `training/*.json` files.

```bash
npm run match-teams
```

### 3. Build Project
Generate the final output files (HTML, ICS, JSON) incorporating the new team data.

```bash
npm run build
```

## Build Commands

```bash
npm ci                    # Install dependencies
npm test                 # Run all tests
npm run build           # Full build (games + calendars + HTML)
npm run build:calendars # Calendars only (~30s)
npm run build:games     # Games only (~2min)  
npm run build:html      # HTML only (fast)
```

## GitHub Actions

### Automatic: Daily at 10:00 UTC (full update)

### Manual Triggers: [Actions Tab](https://github.com/pkcpkc/bc-lions-moabit/actions)

| Button | Duration | Updates |
|--------|----------|---------|
| 🔄 **Full Update** | ~3min | Games + Calendars + HTML |
| 📅 **Calendars Only** | ~30s | Training schedules only |
| 🏀 **Games Only** | ~2min | Game results only |

**Usage:** Actions → "Update BC Lions Moabit Data" → "Run workflow" → Choose type