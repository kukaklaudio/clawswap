use anchor_lang::prelude::*;

declare_id!("Eg5dQXRanxjRjfF28KxvSMfnNNgPGMc63HoVYbmTWqAZ");

#[program]
pub mod clawswap {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, _global_id: u64) -> Result<()> {
        let global = &mut ctx.accounts.global;
        global.authority = ctx.accounts.authority.key();
        global.need_counter = 0;
        global.offer_counter = 0;
        global.deal_counter = 0;
        global.bump = ctx.bumps.global;
        Ok(())
    }

    pub fn create_need(
        ctx: Context<CreateNeed>,
        title: String,
        description: String,
        category: String,
        budget_lamports: u64,
        deadline: Option<i64>
    ) -> Result<()> {
        let global = &mut ctx.accounts.global;
        let need = &mut ctx.accounts.need;
        
        need.id = global.need_counter;
        need.creator = ctx.accounts.creator.key();
        need.title = title;
        need.description = description;
        need.category = category;
        need.budget_lamports = budget_lamports;
        need.status = NeedStatus::Open;
        need.created_at = Clock::get()?.unix_timestamp;
        need.deadline = deadline;
        need.bump = ctx.bumps.need;

        global.need_counter += 1;

        emit!(NeedCreated {
            id: need.id,
            creator: need.creator,
            title: need.title.clone(),
            budget_lamports: need.budget_lamports,
        });

        Ok(())
    }

    pub fn create_offer(
        ctx: Context<CreateOffer>,
        need_id: u64,
        price_lamports: u64,
        message: String,
    ) -> Result<()> {
        let global = &mut ctx.accounts.global;
        let offer = &mut ctx.accounts.offer;
        let need = &ctx.accounts.need;

        require!(need.status == NeedStatus::Open, ErrorCode::NeedNotOpen);
        
        offer.id = global.offer_counter;
        offer.need_id = need_id;
        offer.provider = ctx.accounts.provider.key();
        offer.price_lamports = price_lamports;
        offer.message = message;
        offer.status = OfferStatus::Pending;
        offer.created_at = Clock::get()?.unix_timestamp;
        offer.bump = ctx.bumps.offer;

        global.offer_counter += 1;

        emit!(OfferCreated {
            id: offer.id,
            need_id: offer.need_id,
            provider: offer.provider,
            price_lamports: offer.price_lamports,
        });

        Ok(())
    }

    pub fn accept_offer(ctx: Context<AcceptOffer>) -> Result<()> {
        require!(ctx.accounts.need.status == NeedStatus::Open, ErrorCode::NeedNotOpen);
        require!(ctx.accounts.offer.status == OfferStatus::Pending, ErrorCode::OfferNotPending);
        require!(ctx.accounts.need.creator == ctx.accounts.client.key(), ErrorCode::NotNeedCreator);

        let price = ctx.accounts.offer.price_lamports;

        // Transfer SOL to escrow (deal PDA) — before mutable borrows
        let transfer_ix = anchor_lang::system_program::Transfer {
            from: ctx.accounts.client.to_account_info(),
            to: ctx.accounts.deal.to_account_info(),
        };
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                transfer_ix,
            ),
            price,
        )?;

        // Now take mutable borrows
        let global = &mut ctx.accounts.global;
        let need = &mut ctx.accounts.need;
        let offer = &mut ctx.accounts.offer;
        let deal = &mut ctx.accounts.deal;

        // Update states
        need.status = NeedStatus::InProgress;
        offer.status = OfferStatus::Accepted;

        deal.id = global.deal_counter;
        deal.need_id = need.id;
        deal.offer_id = offer.id;
        deal.client = ctx.accounts.client.key();
        deal.provider = offer.provider;
        deal.amount_lamports = price;
        deal.status = DealStatus::InProgress;
        deal.created_at = Clock::get()?.unix_timestamp;
        deal.delivery_hash = None;
        deal.delivery_content = None;
        deal.dispute_reason = None;
        deal.bump = ctx.bumps.deal;

        global.deal_counter += 1;

        emit!(DealCreated {
            id: deal.id,
            need_id: deal.need_id,
            offer_id: deal.offer_id,
            client: deal.client,
            provider: deal.provider,
            amount_lamports: deal.amount_lamports,
        });

        Ok(())
    }

    pub fn submit_delivery(
        ctx: Context<SubmitDelivery>,
        delivery_hash: String,
        delivery_content: String,
    ) -> Result<()> {
        let deal = &mut ctx.accounts.deal;
        
        require!(deal.status == DealStatus::InProgress, ErrorCode::DealNotInProgress);
        require!(deal.provider == ctx.accounts.provider.key(), ErrorCode::NotProvider);
        require!(delivery_content.len() <= 512, ErrorCode::DeliveryContentTooLong);

        deal.delivery_hash = Some(delivery_hash.clone());
        deal.delivery_content = Some(delivery_content.clone());
        deal.status = DealStatus::DeliverySubmitted;

        emit!(DeliverySubmitted {
            deal_id: deal.id,
            provider: deal.provider,
            delivery_hash,
            delivery_content,
        });

        Ok(())
    }

    pub fn raise_dispute(ctx: Context<RaiseDispute>, dispute_reason: String) -> Result<()> {
        let deal = &mut ctx.accounts.deal;
        let caller = ctx.accounts.caller.key();

        require!(
            deal.status == DealStatus::InProgress || deal.status == DealStatus::DeliverySubmitted,
            ErrorCode::DealNotDisputable
        );
        require!(
            caller == deal.client || caller == deal.provider,
            ErrorCode::NotDealParticipant
        );
        require!(dispute_reason.len() <= 256, ErrorCode::DisputeReasonTooLong);

        deal.status = DealStatus::Disputed;
        deal.dispute_reason = Some(dispute_reason.clone());

        emit!(DisputeRaised {
            deal_id: deal.id,
            raised_by: caller,
            reason: dispute_reason,
        });

        Ok(())
    }

    pub fn resolve_dispute(ctx: Context<ResolveDispute>, resolution: DisputeResolution) -> Result<()> {
        let deal = &mut ctx.accounts.deal;
        let need = &mut ctx.accounts.need;
        let global = &ctx.accounts.global;

        require!(deal.status == DealStatus::Disputed, ErrorCode::DealNotDisputed);
        require!(ctx.accounts.authority.key() == global.authority, ErrorCode::NotAuthority);

        let amount = deal.amount_lamports;

        match resolution {
            DisputeResolution::RefundClient => {
                **deal.to_account_info().lamports.borrow_mut() -= amount;
                **ctx.accounts.client.lamports.borrow_mut() += amount;
                deal.status = DealStatus::Cancelled;
                need.status = NeedStatus::Cancelled;
            }
            DisputeResolution::PayProvider => {
                **deal.to_account_info().lamports.borrow_mut() -= amount;
                **ctx.accounts.provider.lamports.borrow_mut() += amount;
                deal.status = DealStatus::Completed;
                need.status = NeedStatus::Completed;
            }
        }

        emit!(DisputeResolved {
            deal_id: deal.id,
            resolution: resolution.clone(),
        });

        Ok(())
    }

    pub fn cancel_need(ctx: Context<CancelNeed>) -> Result<()> {
        let need = &mut ctx.accounts.need;
        require!(need.status == NeedStatus::Open, ErrorCode::NeedNotOpen);
        require!(need.creator == ctx.accounts.creator.key(), ErrorCode::NotNeedCreator);
        need.status = NeedStatus::Cancelled;

        emit!(NeedCancelled {
            id: need.id,
            creator: need.creator,
        });

        Ok(())
    }

    pub fn cancel_offer(ctx: Context<CancelOffer>) -> Result<()> {
        let offer = &mut ctx.accounts.offer;
        require!(offer.status == OfferStatus::Pending, ErrorCode::OfferNotPending);
        require!(offer.provider == ctx.accounts.provider.key(), ErrorCode::NotProvider);
        offer.status = OfferStatus::Cancelled;

        emit!(OfferCancelled {
            id: offer.id,
            provider: offer.provider,
        });

        Ok(())
    }

    pub fn confirm_delivery(ctx: Context<ConfirmDelivery>) -> Result<()> {
        let deal = &mut ctx.accounts.deal;
        let need = &mut ctx.accounts.need;

        require!(deal.status == DealStatus::DeliverySubmitted, ErrorCode::DeliveryNotSubmitted);
        require!(deal.client == ctx.accounts.client.key(), ErrorCode::NotClient);

        // Transfer escrowed amount from deal PDA to provider
        let amount = deal.amount_lamports;
        **deal.to_account_info().lamports.borrow_mut() -= amount;
        **ctx.accounts.provider.lamports.borrow_mut() += amount;

        deal.status = DealStatus::Completed;
        need.status = NeedStatus::Completed;

        emit!(DeliveryConfirmed {
            deal_id: deal.id,
            client: deal.client,
            provider: deal.provider,
            amount_lamports: deal.amount_lamports,
        });

        Ok(())
    }
}

// Accounts structs
#[derive(Accounts)]
#[instruction(global_id: u64)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = Global::SIZE,
        seeds = [b"global", global_id.to_le_bytes().as_ref()],
        bump
    )]
    pub global: Account<'info, Global>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateNeed<'info> {
    #[account(mut)]
    pub global: Account<'info, Global>,

    #[account(
        init,
        payer = creator,
        space = Need::SIZE,
        seeds = [b"need", global.need_counter.to_le_bytes().as_ref()],
        bump
    )]
    pub need: Account<'info, Need>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(need_id: u64)]
pub struct CreateOffer<'info> {
    #[account(mut)]
    pub global: Account<'info, Global>,

    #[account(
        seeds = [b"need", need_id.to_le_bytes().as_ref()],
        bump = need.bump
    )]
    pub need: Account<'info, Need>,

    #[account(
        init,
        payer = provider,
        space = Offer::SIZE,
        seeds = [b"offer", global.offer_counter.to_le_bytes().as_ref()],
        bump
    )]
    pub offer: Account<'info, Offer>,

    #[account(mut)]
    pub provider: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptOffer<'info> {
    #[account(mut)]
    pub global: Account<'info, Global>,

    #[account(
        mut,
        seeds = [b"need", need.id.to_le_bytes().as_ref()],
        bump = need.bump
    )]
    pub need: Account<'info, Need>,

    #[account(
        mut,
        seeds = [b"offer", offer.id.to_le_bytes().as_ref()],
        bump = offer.bump
    )]
    pub offer: Account<'info, Offer>,

    #[account(
        init,
        payer = client,
        space = Deal::SIZE,
        seeds = [b"deal", global.deal_counter.to_le_bytes().as_ref()],
        bump
    )]
    pub deal: Account<'info, Deal>,

    #[account(mut)]
    pub client: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitDelivery<'info> {
    #[account(
        mut,
        seeds = [b"deal", deal.id.to_le_bytes().as_ref()],
        bump = deal.bump
    )]
    pub deal: Account<'info, Deal>,

    pub provider: Signer<'info>,
}

#[derive(Accounts)]
pub struct ConfirmDelivery<'info> {
    #[account(
        mut,
        seeds = [b"deal", deal.id.to_le_bytes().as_ref()],
        bump = deal.bump
    )]
    pub deal: Account<'info, Deal>,

    #[account(
        mut,
        seeds = [b"need", need.id.to_le_bytes().as_ref()],
        bump = need.bump
    )]
    pub need: Account<'info, Need>,

    #[account(mut)]
    pub client: Signer<'info>,
    
    /// CHECK: Provider account to receive payment
    #[account(mut)]
    pub provider: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct RaiseDispute<'info> {
    #[account(
        mut,
        seeds = [b"deal", deal.id.to_le_bytes().as_ref()],
        bump = deal.bump
    )]
    pub deal: Account<'info, Deal>,

    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    pub global: Account<'info, Global>,

    #[account(
        mut,
        seeds = [b"deal", deal.id.to_le_bytes().as_ref()],
        bump = deal.bump
    )]
    pub deal: Account<'info, Deal>,

    #[account(
        mut,
        seeds = [b"need", need.id.to_le_bytes().as_ref()],
        bump = need.bump
    )]
    pub need: Account<'info, Need>,

    pub authority: Signer<'info>,

    /// CHECK: Client account to receive refund
    #[account(mut)]
    pub client: UncheckedAccount<'info>,

    /// CHECK: Provider account to receive payment
    #[account(mut)]
    pub provider: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CancelNeed<'info> {
    #[account(
        mut,
        seeds = [b"need", need.id.to_le_bytes().as_ref()],
        bump = need.bump
    )]
    pub need: Account<'info, Need>,

    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelOffer<'info> {
    #[account(
        mut,
        seeds = [b"offer", offer.id.to_le_bytes().as_ref()],
        bump = offer.bump
    )]
    pub offer: Account<'info, Offer>,

    pub provider: Signer<'info>,
}

// Data structs
#[account]
pub struct Global {
    pub authority: Pubkey,
    pub need_counter: u64,
    pub offer_counter: u64,
    pub deal_counter: u64,
    pub bump: u8,
}

impl Global {
    pub const SIZE: usize = 8 + 32 + 8 + 8 + 8 + 1;
}

#[account]
pub struct Need {
    pub id: u64,
    pub creator: Pubkey,
    pub title: String,
    pub description: String,
    pub category: String,
    pub budget_lamports: u64,
    pub status: NeedStatus,
    pub created_at: i64,
    pub deadline: Option<i64>,
    pub bump: u8,
}

impl Need {
    pub const SIZE: usize = 8 + 8 + 32 + (4 + 64) + (4 + 256) + (4 + 32) + 8 + 1 + 8 + (1 + 8) + 1;
}

#[account]
pub struct Offer {
    pub id: u64,
    pub need_id: u64,
    pub provider: Pubkey,
    pub price_lamports: u64,
    pub message: String,
    pub status: OfferStatus,
    pub created_at: i64,
    pub bump: u8,
}

impl Offer {
    pub const SIZE: usize = 8 + 8 + 8 + 32 + 8 + (4 + 256) + 1 + 8 + 1;
}

#[account]
pub struct Deal {
    pub id: u64,
    pub need_id: u64,
    pub offer_id: u64,
    pub client: Pubkey,
    pub provider: Pubkey,
    pub amount_lamports: u64,
    pub status: DealStatus,
    pub created_at: i64,
    pub delivery_hash: Option<String>,
    pub delivery_content: Option<String>,
    pub dispute_reason: Option<String>,
    pub bump: u8,
}

impl Deal {
    // +1 (Option) +4 (String len) +512 (max content) for delivery_content
    // +1 (Option) +4 (String len) +256 (max dispute_reason)
    pub const SIZE: usize = 8 + 8 + 8 + 8 + 32 + 32 + 8 + 1 + 8 + (1 + 4 + 64) + (1 + 4 + 512) + (1 + 4 + 256) + 1;
}

// Enums
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum NeedStatus {
    Open,
    InProgress,
    Completed,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OfferStatus {
    Pending,
    Accepted,
    Rejected,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum DisputeResolution {
    RefundClient,
    PayProvider,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum DealStatus {
    InProgress,
    DeliverySubmitted,
    Completed,
    Disputed,
    Cancelled,
}

// Events
#[event]
pub struct NeedCreated {
    pub id: u64,
    pub creator: Pubkey,
    pub title: String,
    pub budget_lamports: u64,
}

#[event]
pub struct OfferCreated {
    pub id: u64,
    pub need_id: u64,
    pub provider: Pubkey,
    pub price_lamports: u64,
}

#[event]
pub struct DealCreated {
    pub id: u64,
    pub need_id: u64,
    pub offer_id: u64,
    pub client: Pubkey,
    pub provider: Pubkey,
    pub amount_lamports: u64,
}

#[event]
pub struct DeliverySubmitted {
    pub deal_id: u64,
    pub provider: Pubkey,
    pub delivery_hash: String,
    pub delivery_content: String,
}

#[event]
pub struct DeliveryConfirmed {
    pub deal_id: u64,
    pub client: Pubkey,
    pub provider: Pubkey,
    pub amount_lamports: u64,
}

#[event]
pub struct DisputeRaised {
    pub deal_id: u64,
    pub raised_by: Pubkey,
    pub reason: String,
}

#[event]
pub struct DisputeResolved {
    pub deal_id: u64,
    pub resolution: DisputeResolution,
}

#[event]
pub struct NeedCancelled {
    pub id: u64,
    pub creator: Pubkey,
}

#[event]
pub struct OfferCancelled {
    pub id: u64,
    pub provider: Pubkey,
}

// Errors
#[error_code]
pub enum ErrorCode {
    #[msg("Need is not open")]
    NeedNotOpen,
    #[msg("Offer is not pending")]
    OfferNotPending,
    #[msg("Not the creator of the need")]
    NotNeedCreator,
    #[msg("Deal is not in progress")]
    DealNotInProgress,
    #[msg("Not the provider")]
    NotProvider,
    #[msg("Delivery not submitted")]
    DeliveryNotSubmitted,
    #[msg("Not the client")]
    NotClient,
    #[msg("Delivery content exceeds 512 characters")]
    DeliveryContentTooLong,
    #[msg("Deal cannot be disputed in current status")]
    DealNotDisputable,
    #[msg("Not a participant in this deal")]
    NotDealParticipant,
    #[msg("Dispute reason exceeds 256 characters")]
    DisputeReasonTooLong,
    #[msg("Deal is not disputed")]
    DealNotDisputed,
    #[msg("Not the global authority")]
    NotAuthority,
}
