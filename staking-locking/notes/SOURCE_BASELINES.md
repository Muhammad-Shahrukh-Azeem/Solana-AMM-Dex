# Source Baselines

Imported on 2026-04-12 UTC.

Staking baseline:
- Source repo: `https://github.com/QuarryProtocol/quarry`
- Imported programs:
  - `programs/quarry-mine` -> `staking-locking/programs/kedolik-staking-v1`
  - `programs/quarry-mint-wrapper` -> `staking-locking/programs/kedolik-mint-wrapper-v1`
- Upstream README says Quarry is audited by Quantstamp and licensed under AGPL-3.0.

Locking baseline:
- Source repo: `https://github.com/jup-ag/jup-lock`
- Imported program:
  - `programs/locker` -> `staking-locking/programs/kedolik-locker-v1`
  - `merkle-verify` -> `staking-locking/merkle-verify`
- Upstream README says Jupiter Locker is audited by Sec3 and OtterSec and licensed under Apache-2.0.
- The cloned `jup-lock` snapshot did not contain a top-level `LICENSE` file, so the README is the current license reference inside this repo copy.

Current policy for imported code:
- Preserve upstream logic first.
- Only patch workspace wiring and path dependencies until the baseline compiles cleanly.
- Rename on-chain IDs and deeper namespaces only after the local baseline is stable.
