# PNE Core

`pne-core` will hold the portable planning engine behind the hosted Modal service.

The initial extraction target is interface-first:

- accept source profiles from a `WarehouseConnector`
- plan projections and insight candidates
- ask `SentinelCore` to review generated artifacts
- validate query payloads through connector execution
- return answers, SQL, evidence, caveats and optional visualization payloads

The current hosted implementation remains in `modal_apps/pne.py` and `modal_apps/pne_core/*` until the contracts are stable enough to move code safely.
