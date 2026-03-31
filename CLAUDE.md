# Prey Node Client

## Overview

Node.js agent for Prey device tracking and security platform. The agent runs on endpoints (Windows, macOS, Linux), connects to a centralized control panel, and enables device location, security actions (lock/wipe), data protection, and remote management.

**Purpose**: Unattended system agent providing device security and management capabilities
**Repository**: GitLab (see git remote)
**License**: GPLv3

## Tech Stack

- **Runtime**: Node.js >=20.16.0
- **Database**: SQLite3 (local persistence)
- **Testing**: Mocha + Chai + Sinon
- **Transport**: WebSockets (primary), Long-Polling (fallback), HTTP
- **Key Dependencies**: 
  - `needle` (HTTP client)
  - `ws` (WebSocket)
  - `async` (control flow)
  - `sqlite3` (storage)
  - `systeminformation` (hardware data)

## Project Structure

### Core Directories

**[lib/agent/](lib/agent/)** - Main agent logic
- [index.js](lib/agent/index.js#L1-L100) - Entry point, lifecycle management
- [hooks.js](lib/agent/hooks.js) - Central EventEmitter event bus
- [common.js](lib/agent/common.js) - Shared dependencies & config

**[lib/agent/actions/](lib/agent/actions/)** - Remote-triggered actions
- Modules: `alarm`, `lock`, `wipe`, `fileretrieval`, `logretrieval`, etc.
- Convention: each exports `start(id, opts, cb)`, returns EventEmitter
- Loader: [lib/agent/actions.js:10-18](lib/agent/actions.js#L10-L18)

**[lib/agent/providers/](lib/agent/providers/)** - Data collection modules
- Modules: `geo`, `hardware`, `network`, `screenshot`, `system`, `users`, etc.
- Convention: export functions prefixed with `get_` for auto-discovery
- Loader: [lib/agent/providers.js:30-50](lib/agent/providers.js#L30-L50)

**[lib/agent/triggers/](lib/agent/triggers/)** - Event-based automation
- System event watchers (network changes, battery, geofencing, etc.)
- Similar interface to actions

**[lib/agent/control-panel/](lib/agent/control-panel/)** - Server communication
- [websockets/](lib/agent/control-panel/websockets/) - Primary transport
- [long-polling/](lib/agent/control-panel/long-polling/) - Fallback transport
- [api/](lib/agent/control-panel/api/) - REST API abstraction

**[lib/system/](lib/system/)** - OS abstraction layer
- [mac/](lib/system/mac/), [linux/](lib/system/linux/), [windows/](lib/system/windows/) - Platform-specific implementations
- [index.js](lib/system/index.js#L9-L10) - Platform normalization & dynamic loading

**[lib/conf/](lib/conf/)** - Configuration management
- [shared.js](lib/conf/shared.js) - Config file discovery
- Settings, API keys, panel connection details

**[lib/utils/](lib/utils/)** - Shared utilities
- [configfile.js](lib/utils/configfile.js) - Config file operations
- [permissionfile.js](lib/utils/permissionfile.js) - Permission tracking

**[lib/agent/utils/](lib/agent/utils/)** - Agent-specific utilities
- [storage.js](lib/agent/utils/storage.js#L11-L80) - SQLite wrapper with queue-based operations

**[lib/constants/](lib/constants/)** - Constants & enums

**[test/](test/)** - Unit tests (mirrors lib/ structure)

**[bin/](bin/)** - Entry point scripts
- `prey` - Main executable
- `prey.cmd` - Windows wrapper

## Essential Commands

### Running
```bash
npm start                    # Start agent
./bin/prey                   # Direct execution
```

### Testing
```bash
npm test                     # Run all tests (nyc + mocha)
npm run test-sf              # Run tests without coverage
npx mocha <path>             # Run specific test file
```

### Code Quality
```bash
npm run lint                 # Check linting
npm run lint-fix             # Auto-fix linting issues
npm run coverage             # Generate coverage report
```

### Development
```bash
npm run format               # Format code with Prettier
npm run sonar                # Run SonarQube analysis
```

## Key Concepts

**Event-Driven Architecture**: Central hooks system ([lib/agent/hooks.js](lib/agent/hooks.js)) coordinates all components via EventEmitter

**Dynamic Loading**: Actions, triggers, and providers discovered/loaded by convention (see patterns doc)

**Cross-Platform**: OS-specific code isolated to [lib/system/{os}/](lib/system/), dynamically loaded based on `process.platform`

**Callback-Based**: Uses callback pattern + `async` library (not promises/async-await)

**Dual Config**: File-based defaults + SQLite runtime storage

**Transport Fallback**: WebSockets → Long-Polling → HTTP

## Development Guidelines

- **Follow Existing Patterns**: Maintain consistency with established codebase patterns
- **No New Dependencies**: Do not introduce new dependencies without team discussion
- **Explicit Error Handling**: Handle errors explicitly - this is a system agent that runs unattended
- **Test Coverage**: Ensure all changes have corresponding tests

## Git Workflow

**Branches**
- `master` - Production
- `develop` - Integration (target for all MRs)
- Always branch from `develop` for all work

**Branch Naming**
- Bugs: `fix/<JIRA_KEY>-<short-desc>`
- Features: `feat/<JIRA_KEY>-<short-desc>`
- Chores: `chore/<JIRA_KEY>-<short-desc>`
- Use lowercase, hyphens for spaces, keep description under 5 words

**Commit Format**
```
<type>(<scope>): <description>

Refs: <JIRA_KEY>
```

Types: `fix`, `feat`, `chore`, `refactor`, `test`, `docs`

Example:
```
fix(api): handle malformed response body

Refs: OWCA-453
```

**Merge Requests**
- Always target `develop`
- Use template from `.gitlab/merge_request_templates/default.md`
- Link Jira key in "Related issues" section
- Fill all checklist items in template

**Testing Requirement**: All tests MUST pass before committing (`npm test`)

## Additional Documentation

For specialized topics, consult these documents:

- [Architectural Patterns](.claude/docs/architectural_patterns.md) - Event system, dynamic loading, cross-platform patterns, async conventions
