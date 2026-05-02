# Build Status

Updated on 2026-04-12 UTC.

Locker baseline:
- Program: `programs/kedolik-locker-v1`
- Dependency helper crate: `merkle-verify`
- `cargo test -p locker --manifest-path staking-locking/Cargo.toml`: passed
- `anchor build` under local Solana `2.1.0` / platform-tools `v1.43`: passed for the locker program after pinning the lockfile away from newer crates that require `edition2024` or Rust newer than Solana's bundled `rustc 1.79.0-dev`

Quarry staking baseline:
- Programs:
  - `programs/kedolik-staking-v1`
  - `programs/kedolik-mint-wrapper-v1`
- `cargo test -p quarry-mint-wrapper -p quarry-mine --manifest-path staking-locking/Cargo.toml`: passed after a small local compatibility fix in `src/rewarder.rs`
- In the current combined Anchor workspace, the build reaches the Quarry generation after Locker, but the current toolchain path is still not clean enough to treat as deployment-ready.

Compatibility notes:
- The local machine has:
  - system Cargo/Rust: `1.90.0`
  - `anchor-cli`: `0.31.1`
  - Solana SBF Rust: `1.79.0-dev`
- The locker baseline matches the newer Anchor/Solana generation closely enough to stabilize locally.
- The Quarry baseline is older Anchor-era code and should be isolated into its own deployment workspace/toolchain before actual deploy work.

Lockfile pins added for Solana SBF compatibility:
- `blake3` pinned to `1.5.5`
- `proc-macro-crate` pinned to `3.2.0`
- `indexmap` pinned to `2.7.0`
- `unicode-segmentation` pinned to `1.12.0`
