# Kedolik Staking And Locking Workspace

This is a separate Rust/Anchor workspace for staking and locking work so the AMM code stays isolated while we adapt proven upstream implementations.

Current baselines:
- `programs/kedolik-staking-v1`: imported from Quarry `quarry-mine`
- `programs/kedolik-mint-wrapper-v1`: imported from Quarry `quarry-mint-wrapper`
- `programs/kedolik-locker-v1`: imported from Jupiter Locker `locker`
- `merkle-verify`: imported from Jupiter Locker

Why these baselines:
- Quarry is one of the strongest production Solana references for token staking rewards distribution.
- Jupiter Locker is a stronger fit for token locking than Tribeca for this repo because it is audited and Apache-2.0 licensed.

Current build status:
- `programs/kedolik-locker-v1` passes `cargo test` and a full `anchor build` under the current local Solana `2.1.0` toolchain after pinning the lockfile to SBF-compatible crate versions.
- `programs/kedolik-staking-v1` and `programs/kedolik-mint-wrapper-v1` pass `cargo test`, but the current local `anchor-cli 0.31.1` plus Solana SBF toolchain is not a clean deployment path for the older Quarry generation yet.
- The current recommendation is to keep Locker and Quarry isolated at the workspace/toolchain level before deployment work.

Important license notes:
- Quarry code is AGPL-3.0. See `upstream-licenses/QUARRY-AGPL-3.0.txt`.
- Jupiter Locker states Apache-2.0 in its README, but the cloned repo snapshot did not include a top-level `LICENSE` file. See `notes/SOURCE_BASELINES.md`.

Operational note:
- This workspace uses the same provider wallet path as the main repo: `~/.config/solana/mainnet-deployer.json`.
- I kept the imported source as close to upstream as possible in this first pass to reduce risk while we establish a safe local baseline.
