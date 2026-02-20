# List Issues

List pending issues from the imported issues file.

## Steps

1. Read `jira_issues.json`
2. Filter only issues where `done` is `false`
3. Display a formatted table with columns: Issue ID, Jira Key, Title
4. Sort by Jira key (OWCA number)
5. Show total count at the end

## Output Format
```
| Issue ID | Jira Key | Title |
|----------|----------|-------|
| 4586     | OWCA-453 | [object Object] (400) |
| ...      | ...      | ... |

Total: N issues
```
