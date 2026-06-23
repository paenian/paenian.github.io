# Test Verification After Tasks

After completing any implementation task (code changes, file creation, or file modification), always run the full test suite to verify nothing is broken:

```bash
cd /Users/paulchase/github/paenian.github.io/webtend && npx vitest --run
```

- If any tests fail, fix them before considering the task complete.
- Report the test results (pass/fail count) as part of the task completion summary.
- Do not proceed to the next task if tests are failing.
