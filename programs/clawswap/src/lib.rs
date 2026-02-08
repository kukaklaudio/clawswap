use anchor_lang::prelude::*;

declare_id!("FKTdYU5qqErJWkB1k2atg9v8JzwsYNveD2W1jAgoYNAW");

#[program]
pub mod clawswap {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
