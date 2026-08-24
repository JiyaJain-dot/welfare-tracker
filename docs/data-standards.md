# Data Standards

This document defines the common schema our system normalizes every
connected external source into. It exists to answer one question:
**"When we say we support interoperability, what does that actually
mean at the data level?"**

## Why this exists

Different government departments store the same real-world facts under
different field names. Our own Welfare Tracker calls a person's name
`name`; the Ration Card System calls it `applicant_full_name`. Without
a shared internal shape, every new connected system would mean writing
one-off logic scattered across the codebase to handle its quirks.

Instead, every external connector's only job is to translate its
source system's fields into the schema below *before* that data ever
reaches our application logic, our database, or our dashboards. Nothing
downstream of a connector needs to know or care what the original field
names were.

## The Common Schema

Every application record - whether it originated in our own database or
was pulled in from a connected external system - is represented
internally as:

| Field | Type | Meaning |
|---|---|---|
| `applicant_id` | string | Unique identifier for the applicant. For local records this is our own `applicant_id`; for external records it's a prefixed version of their native ID (e.g. `ration-RC-2026-0001`) to avoid collisions. |
| `name` | string | Applicant's full name. |
| `phone` | string | Applicant's contact phone number. Used as the primary key for matching the same person across systems. |
| `scheme_type` | string | Human-readable name of the scheme/benefit (e.g. "Old age pension", "Ration card benefit"). |
| `source_system` | string | Which system this record originated from (e.g. "Welfare Tracker", "Ration Card System"). Always present, always shown on the dashboard, so officers and citizens can see where each piece of data actually came from. |
| `status` | string | Normalized to one of: `submitted`, `verification`, `review`, `approved`, `rejected` - regardless of what status vocabulary the source system uses internally. |
| `last_updated` | ISO 8601 datetime | When this record's status last changed. |

## Example: how the Ration Card System gets normalized

The external system's raw data:
```json
{
  "card_id": "RC-2026-0001",
  "applicant_full_name": "Ramesh Kumar",
  "phone_number": "9999999999",
  "card_status": "Issued",
  "submission_date": "2026-07-01T00:00:00.000Z"
}
```

After passing through our connector, it becomes:
```json
{
  "applicant_id": "ration-RC-2026-0001",
  "name": "Ramesh Kumar",
  "phone": "9999999999",
  "scheme_type": "Ration card benefit",
  "source_system": "Ration Card System",
  "status": "approved",
  "last_updated": "2026-07-01T00:00:00.000Z"
}
```

Status values are mapped explicitly per source system (e.g. the Ration
Card System's `"Issued"` maps to our `"approved"`), rather than assumed -
every connector maintains its own status-mapping table since no two
government systems use the same vocabulary for "done."

## Consent and data sharing

Matching an applicant across systems (by phone number) does not mean
their data from a connected system is automatically shown. External
data for a given citizen is withheld until an officer explicitly
requests and receives consent for that specific application - the
common schema defines *what* data looks like once shared, not *when*
it's allowed to be shared. See the consent gating logic in the officer
routes for enforcement.

## Adding a new connected system

To connect a new department's system, a connector must:
1. Fetch that system's native data
2. Map every field into the common schema above (including a status
   mapping table specific to that source)
3. Tag every record with the correct `source_system` value
4. Fail open - if the external system is unreachable, return an empty
   result rather than breaking the rest of the dashboard

No other part of the application should need to change to support a
new connected system beyond adding its connector module.
