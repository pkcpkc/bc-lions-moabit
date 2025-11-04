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