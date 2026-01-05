---
description: Add matching teamIds from /spiele to /training
---
This workflow scans the `spiele` directory for team configurations and adds their IDs to the corresponding training group files in `training`.

1. Run the matching script
// turbo
```bash
node src/commands/matchTeams.js
```
