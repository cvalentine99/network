# Slice 02 Receipt Audit Findings

## Issue 1: No actual screenshot image in project

The receipt claimed "Populated state: Captured" but the screenshots/ directory only contained
slice02-notes.md (a text description). The actual PNG was in /home/ubuntu/screenshots/ (the
sandbox screenshot directory), not inside the project. Fixed by copying
webdev-preview-1773345883.png into screenshots/slice02-populated.png.

## Issue 2: BFF route serves impact-overview.* fixtures, not headline.* fixtures

The BFF route at server/routes/impact.ts lines 83-85 loads:
- impact-overview.populated.fixture.json (when durationMs > 0)
- impact-overview.quiet.fixture.json (when durationMs <= 0)

It does NOT load the headline.* fixture files created in Slice 02:
- headline.populated.fixture.json
- headline.quiet.fixture.json
- headline.transport-error.fixture.json
- headline.malformed.fixture.json
- headline.negative-baseline.fixture.json

The headline.* fixtures exist for test use only (slice02.test.ts schema validation).
The BFF route extracts .headline from the impact-overview.* fixtures, which are the
full ImpactOverviewPayload shape containing headline + other fields.

The receipt should state precisely:
- BFF route serves data extracted from impact-overview.populated.fixture.json and
  impact-overview.quiet.fixture.json (the full ImpactOverviewPayload fixtures from Slice 00)
- headline.*.fixture.json files are used by slice02.test.ts for schema validation tests only
- These are two different fixture sets serving two different purposes
