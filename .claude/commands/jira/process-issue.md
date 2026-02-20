# Process Issue

Process issue ID: $ARGUMENTS from the imported issues list.

## Steps

### 1. Load Issue
- Read `jira_issues.json` and find the issue with ID `$ARGUMENTS`
- Extract the `jira_key` and `title`
- If the issue ID is not found, inform the user and stop

### 2. Create Branch
- Ensure you are on `develop` and it is up to date: `git checkout develop && git pull origin develop`
- Determine the type from the issue context (fix for bugs, feat for features)
- Create a branch following the naming convention: `<type>/<jira_key>-<short-description>`
- The short description comes from the issue title, lowercased, spaces replaced with hyphens, max 5 words, special characters removed

### 3. Investigate
- Search the codebase for code related to the error/issue title
- Understand the root cause or the area where changes are needed
- For bugs: use the systematic-debugging skill if the issue requires deep investigation
- For features: use the brainstorming skill to explore the design

### 4. Implement
- Apply the fix or implement the feature
- Follow existing code patterns and conventions from CLAUDE.md
- Keep changes minimal and focused on the issue

### 5. Test
- Run `npm test` to verify all tests pass
- If tests fail, fix the issues before proceeding
- Add new tests if the change warrants it

### 6. Commit
- Stage only the relevant changed files (not unrelated files)
- Commit with the format: `<type>(<scope>): <description>\n\nRefs: <jira_key>`
- Do NOT commit `jira_issues.json` or any unrelated files

### 7. Push and Create MR
- **Ask the user for confirmation before proceeding with push and MR creation**
- Push the branch: `git push -u origin <branch-name>`
- Create a merge request against `develop` using the GitLab API via `glab` or `git push -o`:
  ```
  git push -u origin <branch-name> \
    -o merge_request.create \
    -o merge_request.target=develop \
    -o merge_request.title="<type>(<scope>): <description>" \
    -o merge_request.description="$(cat .gitlab/merge_request_templates/default.md)"
  ```
- Fill in the MR description with:
  - Change description summarizing what was done
  - Type of change checked (Bug fix or New feature)
  - Related issues: `Refs: <jira_key>`
  - Checklist items checked as appropriate

### 8. Mark Issue as Done
- In `jira_issues.json`, find the issue with ID `$ARGUMENTS` and change its `done` attribute from `false` to `true`
- Do NOT commit this change (it is a local tracking update)

### 9. Summary
- Report what was done: branch name, changes made, MR URL
- Suggest next steps if applicable
