//! Contains addresses used for the Quarry program.
//! These addresses are updated via program upgrades.

use anchor_lang::prelude::*;

/// Wrapper module.
pub mod fee_to {
    use anchor_lang::declare_id;

    declare_id!("68ntKmiyhSdRT448Hj1VPW19a7EERJHCcGyjbmodVqot");
}

/// Wrapper module.
pub mod fee_setter {
    use anchor_lang::declare_id;

    declare_id!("68ntKmiyhSdRT448Hj1VPW19a7EERJHCcGyjbmodVqot");
}

/// Account authorized to take fees.
pub static FEE_TO: Pubkey = fee_to::ID;

/// Account authorized to set fees of a rewarder. Currently unused.
pub static FEE_SETTER: Pubkey = fee_setter::ID;
