//! # FundChain — Program Solana de Crowdfunding
//!
//! Autor: Marian Dumitru Vamanu
//!
//! Instructiuni implementate:
//! - Campanie simpla SOL: create_campaign, donate, withdraw
//! - Campanie milestone SOL: create_milestone_campaign, donate_milestone, submit_milestone, vote_milestone, finalize_milestone
//! - Campanie USDC: create_usdc_campaign, donate_usdc, withdraw_usdc

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};

declare_id!("9Q26M3XJE9pveumjKK4VxMfBu8EQXPnqHHTNXfSU5kEi");

#[program]
pub mod crowdfunding {
    use super::*;

    pub fn create_campaign(ctx: Context<CreateCampaign>, title: String, description: String, goal: u64) -> Result<()> {
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
        let transfer = anchor_lang::solana_program::system_instruction::transfer(&donor_key, &campaign_key, amount);
        anchor_lang::solana_program::program::invoke(&transfer, &[ctx.accounts.donor.to_account_info(), ctx.accounts.campaign.to_account_info()])?;
        ctx.accounts.campaign.amount_raised += amount;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        require!(campaign.owner == ctx.accounts.owner.key(), CrowdfundingError::Unauthorized);
        require!(campaign.amount_raised >= campaign.goal, CrowdfundingError::GoalNotReached);
        campaign.is_active = false;
        Ok(())
    }

    pub fn create_usdc_campaign(ctx: Context<CreateUsdcCampaign>, title: String, description: String, goal: u64) -> Result<()> {
        let campaign = &mut ctx.accounts.usdc_campaign;
        campaign.owner = ctx.accounts.owner.key();
        campaign.title = title;
        campaign.description = description;
        campaign.goal = goal;
        campaign.amount_raised = 0;
        campaign.is_active = true;
        campaign.goal_reached = false;
        campaign.usdc_mint = ctx.accounts.usdc_mint.key();
        campaign.vault = ctx.accounts.vault.key();
        Ok(())
    }

    pub fn donate_usdc(ctx: Context<DonateUsdc>, amount: u64) -> Result<()> {
        require!(ctx.accounts.usdc_campaign.is_active, CrowdfundingError::CampaignInactive);
        require!(amount > 0, CrowdfundingError::InvalidAmount);
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.donor_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.donor.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;
        let campaign = &mut ctx.accounts.usdc_campaign;
        campaign.amount_raised += amount;
        if campaign.amount_raised >= campaign.goal { campaign.goal_reached = true; }
        let donor = &mut ctx.accounts.donor_usdc_account;
        donor.campaign = campaign.key();
        donor.donor = ctx.accounts.donor.key();
        donor.amount += amount;
        Ok(())
    }

    pub fn withdraw_usdc(ctx: Context<WithdrawUsdc>) -> Result<()> {
        let campaign = &ctx.accounts.usdc_campaign;
        require!(campaign.owner == ctx.accounts.owner.key(), CrowdfundingError::Unauthorized);
        require!(campaign.goal_reached, CrowdfundingError::GoalNotReached);
        require!(campaign.is_active, CrowdfundingError::CampaignInactive);
        let amount = campaign.amount_raised;
        let campaign_key = campaign.key();
        let seeds = &[b"vault", campaign_key.as_ref(), &[ctx.bumps.vault]];
        let signer = &[&seeds[..]];
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.owner_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer,
        );
        token::transfer(transfer_ctx, amount)?;
        ctx.accounts.usdc_campaign.is_active = false;
        Ok(())
    }

    pub fn create_milestone_campaign(ctx: Context<CreateMilestoneCampaign>, title: String, description: String, milestone_titles: Vec<String>, milestone_descriptions: Vec<String>, milestone_amounts: Vec<u64>) -> Result<()> {
        require!(milestone_titles.len() >= 2, CrowdfundingError::TooFewMilestones);
        require!(milestone_titles.len() == milestone_amounts.len(), CrowdfundingError::InvalidData);
        require!(milestone_titles.len() <= 5, CrowdfundingError::TooManyMilestones);
        let total_goal: u64 = milestone_amounts.iter().sum();
        let campaign = &mut ctx.accounts.milestone_campaign;
        campaign.owner = ctx.accounts.owner.key();
        campaign.title = title;
        campaign.description = description;
        campaign.total_goal = total_goal;
        campaign.amount_raised = 0;
        campaign.is_active = true;
        campaign.current_milestone = 0;
        campaign.milestone_count = milestone_titles.len() as u8;
        for i in 0..milestone_titles.len() {
            campaign.milestones[i] = Milestone {
                title: milestone_titles[i].clone(),
                description: milestone_descriptions[i].clone(),
                amount: milestone_amounts[i],
                completed: false, approved: false,
                votes_for: 0, votes_against: 0,
                voting_active: false, voting_deadline: 0,
            };
        }
        Ok(())
    }

    pub fn donate_milestone(ctx: Context<DonateMilestone>, amount: u64) -> Result<()> {
        require!(ctx.accounts.milestone_campaign.is_active, CrowdfundingError::CampaignInactive);
        let campaign_key = ctx.accounts.milestone_campaign.key();
        let donor_key = ctx.accounts.donor.key();
        let transfer = anchor_lang::solana_program::system_instruction::transfer(&donor_key, &campaign_key, amount);
        anchor_lang::solana_program::program::invoke(&transfer, &[ctx.accounts.donor.to_account_info(), ctx.accounts.milestone_campaign.to_account_info()])?;
        ctx.accounts.milestone_campaign.amount_raised += amount;
        let donor = &mut ctx.accounts.donor_account;
        donor.campaign = campaign_key;
        donor.donor = donor_key;
        donor.amount += amount;
        Ok(())
    }

    pub fn submit_milestone(ctx: Context<SubmitMilestone>) -> Result<()> {
        let campaign = &mut ctx.accounts.milestone_campaign;
        require!(campaign.owner == ctx.accounts.owner.key(), CrowdfundingError::Unauthorized);
        require!(campaign.is_active, CrowdfundingError::CampaignInactive);
        require!(campaign.amount_raised >= campaign.total_goal, CrowdfundingError::GoalNotReached);
        let idx = campaign.current_milestone as usize;
        require!(!campaign.milestones[idx].voting_active, CrowdfundingError::VotingAlreadyActive);
        require!(!campaign.milestones[idx].completed, CrowdfundingError::MilestoneAlreadyCompleted);
        let clock = Clock::get()?;
        campaign.milestones[idx].voting_active = true;
        campaign.milestones[idx].voting_deadline = clock.unix_timestamp + 3 * 24 * 3600;
        Ok(())
    }

    pub fn vote_milestone(ctx: Context<VoteMilestone>, milestone_idx: u8, approve: bool) -> Result<()> {
        let donor_amount = ctx.accounts.donor_account.amount;
        require!(donor_amount > 0, CrowdfundingError::NotADonor);
        let vote_record = &mut ctx.accounts.vote_record;
        require!(!vote_record.has_voted, CrowdfundingError::AlreadyVoted);
        let campaign = &mut ctx.accounts.milestone_campaign;
        let idx = milestone_idx as usize;
        require!(campaign.milestones[idx].voting_active, CrowdfundingError::VotingNotActive);
        let clock = Clock::get()?;
        require!(clock.unix_timestamp < campaign.milestones[idx].voting_deadline, CrowdfundingError::VotingExpired);
        vote_record.has_voted = true;
        vote_record.voter = ctx.accounts.voter.key();
        vote_record.campaign = campaign.key();
        vote_record.milestone_idx = milestone_idx;
        if approve { campaign.milestones[idx].votes_for += donor_amount; }
        else { campaign.milestones[idx].votes_against += donor_amount; }
        Ok(())
    }

    pub fn finalize_milestone(ctx: Context<FinalizeMilestone>, milestone_idx: u8) -> Result<()> {
        let campaign = &mut ctx.accounts.milestone_campaign;
        let idx = milestone_idx as usize;
        require!(campaign.milestones[idx].voting_active, CrowdfundingError::VotingNotActive);
        campaign.milestones[idx].voting_active = false;
        if campaign.milestones[idx].votes_for > campaign.milestones[idx].votes_against {
            campaign.milestones[idx].completed = true;
            campaign.milestones[idx].approved = true;
            campaign.current_milestone += 1;
            let amount = campaign.milestones[idx].amount;
            **campaign.to_account_info().try_borrow_mut_lamports()? -= amount;
            **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += amount;
            if campaign.current_milestone as usize >= campaign.milestone_count as usize { campaign.is_active = false; }
        } else {
            campaign.milestones[idx].completed = false;
            campaign.milestones[idx].approved = false;
        }
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

#[derive(Accounts)]
pub struct CreateUsdcCampaign<'info> {
    #[account(init, payer = owner, space = 8 + UsdcCampaign::LEN)]
    pub usdc_campaign: Account<'info, UsdcCampaign>,
    #[account(
        init, payer = owner,
        token::mint = usdc_mint,
        token::authority = vault,
        seeds = [b"vault", usdc_campaign.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DonateUsdc<'info> {
    #[account(mut)]
    pub usdc_campaign: Account<'info, UsdcCampaign>,
    #[account(mut, seeds = [b"vault", usdc_campaign.key().as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub donor_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub donor: Signer<'info>,
    #[account(
        init_if_needed, payer = donor, space = 8 + DonorRecord::LEN,
        seeds = [b"donor_usdc", usdc_campaign.key().as_ref(), donor.key().as_ref()], bump
    )]
    pub donor_usdc_account: Account<'info, DonorRecord>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawUsdc<'info> {
    #[account(mut)]
    pub usdc_campaign: Account<'info, UsdcCampaign>,
    #[account(mut, seeds = [b"vault", usdc_campaign.key().as_ref()], bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub owner_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CreateMilestoneCampaign<'info> {
    #[account(init, payer = owner, space = 8 + MilestoneCampaign::LEN)]
    pub milestone_campaign: Account<'info, MilestoneCampaign>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DonateMilestone<'info> {
    #[account(mut)]
    pub milestone_campaign: Account<'info, MilestoneCampaign>,
    #[account(mut)]
    pub donor: Signer<'info>,
    #[account(init_if_needed, payer = donor, space = 8 + DonorRecord::LEN, seeds = [b"donor", milestone_campaign.key().as_ref(), donor.key().as_ref()], bump)]
    pub donor_account: Account<'info, DonorRecord>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitMilestone<'info> {
    #[account(mut)]
    pub milestone_campaign: Account<'info, MilestoneCampaign>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(milestone_idx: u8)]
pub struct VoteMilestone<'info> {
    #[account(mut)]
    pub milestone_campaign: Account<'info, MilestoneCampaign>,
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account(seeds = [b"donor", milestone_campaign.key().as_ref(), voter.key().as_ref()], bump)]
    pub donor_account: Account<'info, DonorRecord>,
    #[account(init, payer = voter, space = 8 + VoteRecord::LEN, seeds = [b"vote", milestone_campaign.key().as_ref(), voter.key().as_ref(), &[milestone_idx]], bump)]
    pub vote_record: Account<'info, VoteRecord>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(milestone_idx: u8)]
pub struct FinalizeMilestone<'info> {
    #[account(mut)]
    pub milestone_campaign: Account<'info, MilestoneCampaign>,
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
impl Campaign { const LEN: usize = 32 + (4 + 64) + (4 + 256) + 8 + 8 + 1; }

#[account]
pub struct UsdcCampaign {
    pub owner: Pubkey,
    pub title: String,
    pub description: String,
    pub goal: u64,
    pub amount_raised: u64,
    pub is_active: bool,
    pub goal_reached: bool,
    pub usdc_mint: Pubkey,
    pub vault: Pubkey,
}
impl UsdcCampaign { const LEN: usize = 32 + (4 + 64) + (4 + 256) + 8 + 8 + 1 + 1 + 32 + 32; }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct Milestone {
    pub title: String,
    pub description: String,
    pub amount: u64,
    pub completed: bool,
    pub approved: bool,
    pub votes_for: u64,
    pub votes_against: u64,
    pub voting_active: bool,
    pub voting_deadline: i64,
}
impl Milestone { const LEN: usize = (4 + 64) + (4 + 256) + 8 + 1 + 1 + 8 + 8 + 1 + 8; }

#[account]
pub struct MilestoneCampaign {
    pub owner: Pubkey,
    pub title: String,
    pub description: String,
    pub total_goal: u64,
    pub amount_raised: u64,
    pub is_active: bool,
    pub current_milestone: u8,
    pub milestone_count: u8,
    pub milestones: [Milestone; 5],
}
impl MilestoneCampaign { const LEN: usize = 32 + (4 + 64) + (4 + 256) + 8 + 8 + 1 + 1 + 1 + (Milestone::LEN * 5); }

#[account]
pub struct DonorRecord {
    pub campaign: Pubkey,
    pub donor: Pubkey,
    pub amount: u64,
}
impl DonorRecord { const LEN: usize = 32 + 32 + 8; }

#[account]
pub struct VoteRecord {
    pub voter: Pubkey,
    pub campaign: Pubkey,
    pub milestone_idx: u8,
    pub has_voted: bool,
}
impl VoteRecord { const LEN: usize = 32 + 32 + 1 + 1; }

#[error_code]
pub enum CrowdfundingError {
    #[msg("Campania nu este activa")] CampaignInactive,
    #[msg("Nu esti proprietarul campaniei")] Unauthorized,
    #[msg("Obiectivul nu a fost atins")] GoalNotReached,
    #[msg("Minim 2 milestone-uri necesare")] TooFewMilestones,
    #[msg("Maxim 5 milestone-uri permise")] TooManyMilestones,
    #[msg("Date invalide")] InvalidData,
    #[msg("Suma invalida")] InvalidAmount,
    #[msg("Votul este deja activ")] VotingAlreadyActive,
    #[msg("Milestone deja completat")] MilestoneAlreadyCompleted,
    #[msg("Trebuie sa fii donator")] NotADonor,
    #[msg("Ai votat deja")] AlreadyVoted,
    #[msg("Votul nu este activ")] VotingNotActive,
    #[msg("Votul a expirat")] VotingExpired,
}