use anchor_lang::prelude::*;

declare_id!("9Q26M3XJE9pveumjKK4VxMfBu8EQXPnqHHTNXfSU5kEi");

#[program]
pub mod crowdfunding {
    use super::*;

    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        title: String,
        description: String,
        goal: u64,
    ) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        campaign.owner = ctx.accounts.owner.key();
        campaign.title = title;
        campaign.description = description;
        campaign.goal = goal;
        campaign.amount_raised = 0;
        campaign.is_active = true;
        Ok(())
    }

    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        require!(ctx.accounts.campaign.is_active, CrowdfundingError::CampaignInactive);

        let campaign_key = ctx.accounts.campaign.key();
        let donor_key = ctx.accounts.donor.key();

        let transfer = anchor_lang::solana_program::system_instruction::transfer(
            &donor_key,
            &campaign_key,
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer,
            &[
                ctx.accounts.donor.to_account_info(),
                ctx.accounts.campaign.to_account_info(),
            ],
        )?;

        let campaign = &mut ctx.accounts.campaign;
        campaign.amount_raised += amount;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        require!(campaign.owner == ctx.accounts.owner.key(), CrowdfundingError::Unauthorized);
        require!(campaign.amount_raised >= campaign.goal, CrowdfundingError::GoalNotReached);
        campaign.is_active = false;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateCampaign<'info> {
    #[account(init, payer = owner, space = 8 + Campaign::LEN)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Donate<'info> {
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub donor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

#[account]
pub struct Campaign {
    pub owner: Pubkey,
    pub title: String,
    pub description: String,
    pub goal: u64,
    pub amount_raised: u64,
    pub is_active: bool,
}

impl Campaign {
    const LEN: usize = 32 + 64 + 256 + 8 + 8 + 1;
}

#[error_code]
pub enum CrowdfundingError {
    #[msg("Campania nu este activa")]
    CampaignInactive,
    #[msg("Nu esti proprietarul campaniei")]
    Unauthorized,
    #[msg("Obiectivul nu a fost atins")]
    GoalNotReached,
}
