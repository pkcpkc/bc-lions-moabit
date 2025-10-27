# BC Lions Moabit - Copilot Coding Agent Instructions

## Repository Overview

This is an **automated basketball team calendar system** that generates dynamic game schedules and training calendars for BC Lions Moabit basketball club. The system fetches game data from Basketball-Bund API and training schedules from Google Calendar, generates ICS calendar files, and builds a static HTML website deployed via GitHub Pages.

**Key Statistics:**
- **Size:** ~1,563 lines of backend code, ~4,864 lines of tests
- **Type:** Node.js web application with automated data processing
- **Languages:** JavaScript (ES Modules)
- **Runtime:** Node.js 18+ (tested on v20.19.5)
- **Test Framework:** Vitest with 279 tests (100% passing)
- **Architecture:** Service-oriented with dependency injection
- **Deployment:** GitHub Actions (daily at 10:00 UTC) + GitHub Pages

## Build & Test Commands

### Prerequisites
**ALWAYS run `npm ci` first** when starting work or after pulling changes. Never use `npm install` in CI/CD contexts.

```bash
npm ci  # Clean install - ALWAYS use this over npm install
```

### Testing (Fast - ~3 seconds)
```bash
npm test                    # Run all 279 tests (preferred)
npm run test:watch          # Watch mode for development
npm run test:coverage       # Generate coverage report (~80% coverage)
npm test tests/frontend/    # Run only frontend tests (51 tests)
npm test tests/services/    # Run only service tests
npm test tests/commands/    # Run only command tests
```

**Important:** Tests run in Node.js environment with DOM mocking. All tests MUST pass before committing.

### Build Commands (2-3 minutes, requires network)
```bash
npm run build               # Complete build: fetch games + download termine + build HTML
npm run build:html          # Generate HTML only (fast, ~100ms, no network needed)
npm run fetch:games         # Fetch games for one team (for testing)
npm run fetch:all-games     # Fetch games for all 22 teams (~1-2 min)
npm run fetch:calendars     # Download 7 training calendars from Google
npm run crawl               # Discover new teams (rarely needed)
```

**Critical Notes:**
- Build commands make **450+ external API calls** to basketball-bund.net and calendar.google.com
- Commands gracefully handle network failures with **3 retries + exponential backoff**
- Build continues even if some API calls fail - this is expected behavior
- In sandboxed/offline environments, builds will log errors but won't crash
- Always test with `npm test` first - it doesn't require network access

## Project Architecture

### Directory Structure
```
bc-lions-moabit/
├── .github/workflows/      # CI/CD automation
│   └── update-data.yml     # Daily build workflow (10:00 UTC)
├── src/                    # Backend source code (~1,563 lines)
│   ├── commands/           # Command layer (5 files)
│   │   ├── build.js        # Main build orchestrator
│   │   ├── buildHTML.js    # HTML generation
│   │   ├── crawl.js        # Team discovery
│   │   ├── downloadTermine.js  # Training calendar downloads
│   │   └── fetchGames.js   # Game data fetching
│   ├── services/           # Service layer (9 files)
│   │   ├── httpClient.js   # HTTP with retry logic
│   │   ├── gamesService.js # Game processing
│   │   ├── icsService.js   # ICS file generation
│   │   ├── htmlService.js  # HTML template processing
│   │   ├── logger.js       # Structured logging
│   │   ├── configService.js    # Config file management
│   │   ├── crawlService.js     # Team discovery logic
│   │   ├── termineService.js   # Training calendar processing
│   │   └── teamDiscoveryService.js  # Team detection
│   ├── config/             # Configuration
│   │   └── index.js        # Central config (API URLs, timeouts, paths)
│   └── [entry scripts]     # build.js, build-html.js, crawl.js, etc.
├── tests/                  # Comprehensive test suite (~4,864 lines)
│   ├── frontend/           # Frontend tests (51 tests)
│   │   ├── calendar-app.test.js        # Core functions (22 tests)
│   │   ├── calendar-app-dom.test.js    # DOM manipulation (14 tests)
│   │   └── calendar-app-routing.test.js # URL routing (15 tests)
│   ├── commands/           # Command layer tests (5 files)
│   └── services/           # Service layer tests (9 files)
├── teams/                  # Team configurations (22 JSON files)
│   └── *.json             # Format: {competitionId, teamName, teamId}
├── termine/               # Training configurations (7 JSON files)
│   └── *.json            # Format: {label, calId}
├── docs/                 # Generated output & frontend
│   ├── index.html        # Generated website (from template)
│   ├── js/               # Client-side JavaScript
│   │   ├── calendar-app.js          # Main frontend app (~600 lines)
│   │   └── basketball-animation.js   # Visual effects
│   └── ics/              # Generated calendar files
│       ├── spiele/       # Game calendars (22 files)
│       └── termine/      # Training calendars (7 files)
├── index.template.html   # HTML template for generation
├── package.json          # Dependencies and scripts
├── vitest.config.js      # Test configuration
└── README.md             # Comprehensive documentation with diagrams
```

### Key Configuration Files

**vitest.config.js** - Test configuration:
- Environment: Node.js (not jsdom)
- Coverage: v8 provider, excludes tests/node_modules
- No special setup required

**src/config/index.js** - Central configuration:
- API base URL: `https://www.basketball-bund.net/rest`
- Timeouts: 10s (configurable via env vars)
- Retries: 3 attempts with 1s initial delay
- Paths: teams/, docs/ics/spiele/, docs/ics/termine/

**package.json** - Dependencies:
- Runtime: `glob`, `ical.js`, `node-fetch` (v3, ESM)
- Dev: `vitest`, `@vitest/coverage-v8`, `@vitest/ui`
- Type: `"module"` (ES Modules only)

### Architectural Patterns

**Service-Oriented Architecture:**
- Commands orchestrate workflows
- Services contain business logic
- Dependency injection for testability
- Logger passed to all components

**Error Handling:**
- Graceful degradation (continues on failures)
- Structured logging with timestamps
- HTTP retry logic (3 attempts, exponential backoff)
- Detailed error messages in logs

**Data Flow:**
1. Read team/termine configs from JSON files
2. Fetch data from external APIs (with retries)
3. Process and transform data (services)
4. Generate ICS files (icsService)
5. Build HTML from template (htmlService)
6. Output to docs/ directory

## GitHub Actions Workflow

**File:** `.github/workflows/update-data.yml`

**Trigger:** Daily at 10:00 UTC + manual dispatch

**Steps:**
1. Checkout repository
2. Setup Node.js 18 with npm cache
3. `npm ci` - Install dependencies
4. `npm test` - Run all tests (MUST pass or build aborts)
5. `npm run build` - Full build process
6. Git diff check - Detect changes
7. Auto-commit and push if changes detected

**Critical:** If tests fail, the workflow aborts before building. Always ensure `npm test` passes locally.

## Common Issues & Workarounds

### Network Errors During Build
**Symptom:** `getaddrinfo ENOTFOUND www.basketball-bund.net`
**Solution:** This is expected in sandboxed environments. The build will:
- Log errors but continue execution
- Generate empty ICS files if data can't be fetched
- Still succeed in building HTML from existing configs

### Dependency Installation Issues
**Problem:** `npm install` causing inconsistencies
**Solution:** Always use `npm ci` for clean, reproducible installs

### Test Failures
**Common causes:**
- DOM mocking issues: Check global.document/window setup in test files
- Async timing: Ensure proper `await` usage in tests
- Mock data: Verify mock responses match actual API structure

### Build Timeout
**Issue:** Build taking longer than expected
**Typical duration:** 2-3 minutes for full build
**Workaround:** Use `npm run build:html` (fast) if only regenerating HTML

## Making Changes

### When Modifying Backend Code (src/)
1. **Make your changes** to commands/ or services/
2. **Update tests** in tests/commands/ or tests/services/
3. **Run tests:** `npm test` (must pass)
4. **Test build:** `npm run build:html` (fast check)
5. **Commit changes** with clear message

### When Modifying Frontend Code (docs/js/)
1. **Make changes** to calendar-app.js or basketball-animation.js
2. **Update tests** in tests/frontend/
3. **Run tests:** `npm test tests/frontend/`
4. **Manual verification:** Open docs/index.html in browser (if possible)
5. **Commit changes**

### When Modifying Configurations
**Team configs (teams/*.json):**
- Format: `{"competitionId": 50422, "teamName": "BC Lions Moabit 1", "teamId": "he1"}`
- After changes: Run `npm run build:html` to update website

**Termine configs (termine/*.json):**
- Format: `{"label": "Damen", "calId": "xxxx@group.calendar.google.com"}`
- After changes: Run `npm run build:html` to update website

### When Adding Dependencies
1. **Add to package.json** using `npm install <package>`
2. **Run tests:** Ensure nothing breaks
3. **Update this file** if dependency affects build process
4. **Commit package.json AND package-lock.json**

## Code Style Guidelines

- **ES Modules:** Use `import/export`, not `require()`
- **Classes:** Service-oriented with dependency injection
- **Error handling:** Always catch and log errors gracefully
- **Logging:** Use logger.info/warn/error with timestamps
- **Tests:** Comprehensive with mocks for external dependencies
- **No linting:** No ESLint/Prettier configured - match existing style
- **Async/await:** Prefer over promises for readability

## Validation Checklist

Before submitting changes:
- [ ] `npm ci` completes successfully
- [ ] `npm test` shows 279 tests passing (or more if you added tests)
- [ ] `npm run build:html` generates docs/index.html without errors
- [ ] Changed files follow existing code patterns
- [ ] Tests added/updated for new functionality
- [ ] README.md updated if adding major features
- [ ] No console.log() left in code (use logger instead)

## Trust These Instructions

These instructions are validated and accurate. Only search for additional information if:
- You need details about a specific function implementation
- These instructions have an error or omission
- You're implementing a feature not covered here

For routine tasks (testing, building, adding code), trust and follow these instructions directly.
