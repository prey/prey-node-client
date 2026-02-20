# List Issues

List all issues from the imported issues file.

## Steps

1. Read `jira_issues.json`
2. Display a formatted table with columns: Issue ID, Jira Key, Title
3. Sort by Jira key (OWCA number)
4. Show total count at the end

## Output Format
```
| Issue ID | Jira Key | Title |
|----------|----------|-------|
| 4586     | OWCA-453 | [object Object] (400) |
| ...      | ...      | ... |

Total: N issues
```
