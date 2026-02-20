# Prey Node Client

## Project
- Node.js agent for Prey device tracking and security
- Hosted on GitLab (remote configured in git)

## Git Flow
- `master` - Production branch
- `develop` - Integration branch (all MRs target here)
- Branch from `develop` for all work

## Branch Naming
- Bugs: `fix/<jira_key>-<short-description>` (e.g., `fix/OWCA-453-object-object-400`)
- Features: `feat/<jira_key>-<short-description>`
- Chores: `chore/<jira_key>-<short-description>`
- Use lowercase, hyphens for spaces, keep description under 5 words

## Commit Messages
- Format: `<type>(<scope>): <description>`
- Types: fix, feat, chore, refactor, test, docs
- Include Jira reference in body: `Refs: <jira_key>`
- Example:
  ```
  fix(api): handle malformed response body

  Refs: OWCA-453
  ```

## Testing
- Run all tests: `npm test`
- Run specific test: `npx mocha <path>`
- All tests MUST pass before committing

## Merge Requests
- Always target `develop`
- Use the template from `.gitlab/merge_request_templates/default.md`
- Link Jira key in "Related issues" section
- Fill all checklist items in the template

## Code Style
- Follow existing patterns in the codebase
- Do not introduce new dependencies without discussion
- Handle errors explicitly - this is a system agent that runs unattended
