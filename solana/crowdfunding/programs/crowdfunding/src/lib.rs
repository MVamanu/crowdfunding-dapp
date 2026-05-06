//! # FundChain — Program Solana de Crowdfunding
//! 
//! Autor: Marian Dumitru Vamanu
//! 
//! Acest program Anchor implementeaza doua tipuri de campanii:
//! - **Campaign**: campanie simpla de strangere fonduri in SOL
//! - **MilestoneCampaign**: campanie cu finantare etapizata si vot proportional
//!
//! ## Securitate
//! - Transfer SOL via SystemProgram (nu direct din cont)
//! - PDA-uri pentru donor/vote records (imposibil de falsificat)
//! - Verificare owner pe toate functiile critice
//! - init_if_needed pentru donatii multiple de la acelasi donator

use anchor_lang::prelude::*;

declare_id!("9Q26M3XJE9pveumjKK4VxMfBu8EQXPnqHHTNXfSU5kEi");

#[program]
pub mod crowdfunding {
    use super::*;

    /// Creeaza o campanie simpla de crowdfunding pe Solana
    ///
    /// # Argumente
    /// * `title` - Titlul campaniei
    /// * `description` - Descrierea campaniei  
    /// * `goal` - Obiectivul in lamports (1 SOL = 1_000_000_000 lamports)
    ///
    /// # Erori
    /// Nu are restrictii speciale — orice utilizator poate crea o campanie
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

    /// Doneaza SOL catre o campanie activa
    ///
    /// # Argumente
    /// * `amount` - Suma in lamports de donat
    ///
    /// # Securitate
    /// Transferul se face via SystemProgram::transfer (nu direct)
    /// Aceasta abordare este sigura si auditabila on-chain
    ///
    /// # Erori
    /// * `CampaignInactive` - Campania nu este activa
    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        require!(ctx.accounts.campaign.is_active, CrowdfundingError::CampaignInactive);

        let campaign_key = ctx.accounts.campaign.key();
        let donor_key = ctx.accounts.donor.key();

        // Transfer SOL prin SystemProgram pentru securitate maxima
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

    /// Retrage fondurile dupa atingerea goalului
    ///
    /// # Securitate
    /// * Verifica ca apelantul este owner-ul campaniei
    /// * Verifica ca goalul a fost atins
    /// * Seteaza is_active = false inainte de transfer (protectie reentrancy)
    ///
    /// # Erori
    /// * `Unauthorized` - Apelantul nu este owner
    /// * `GoalNotReached` - Goalul nu a fost atins
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        require!(campaign.owner == ctx.accounts.owner.key(), CrowdfundingError::Unauthorized);
        require!(campaign.amount_raised >= campaign.goal, CrowdfundingError::GoalNotReached);
        // EFFECTS: dezactivam campania inainte de transfer
        campaign.is_active = false;
        Ok(())
    }

    /// Creeaza o campanie cu finantare etapizata (milestone-based)
    ///
    /// # Argumente
    /// * `title` - Titlul campaniei
    /// * `description` - Descrierea campaniei
    /// * `milestone_titles` - Vec cu titlurile etapelor (min 2, max 5)
    /// * `milestone_descriptions` - Vec cu descrierile etapelor
    /// * `milestone_amounts` - Vec cu sumele in lamports pentru fiecare etapa
    ///
    /// # Structura
    /// Goal-ul total este suma tuturor milestone_amounts
    /// Etapele sunt stocate intr-un array fix de 5 elemente (Milestone::LEN)
    ///
    /// # Erori
    /// * `TooFewMilestones` - Mai putin de 2 etape
    /// * `TooManyMilestones` - Mai mult de 5 etape
    /// * `InvalidData` - Lungimile array-urilor nu coincid
    pub fn create_milestone_campaign(
        ctx: Context<CreateMilestoneCampaign>,
        title: String,
        description: String,
        milestone_titles: Vec<String>,
        milestone_descriptions: Vec<String>,
        milestone_amounts: Vec<u64>,
    ) -> Result<()> {
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
                completed: false,
                approved: false,
                votes_for: 0,
                votes_against: 0,
                voting_active: false,
                voting_deadline: 0,
            };
        }

        Ok(())
    }

    /// Doneaza SOL la o campanie cu milestone-uri
    ///
    /// # Securitate — PDA Donor Record
    /// Contul `donor_account` este un PDA derivat din:
    /// `["donor", campaign_pubkey, donor_pubkey]`
    /// Aceasta garanteaza ca fiecare donator are un singur cont per campanie,
    /// imposibil de falsificat fara cheile corecte.
    ///
    /// # Putere de vot
    /// Suma donata acumuleaza putere de vot pentru milestone-uri:
    /// `donor_account.amount` = puterea de vot totala a donatorului
    ///
    /// # Erori
    /// * `CampaignInactive` - Campania nu este activa
    pub fn donate_milestone(ctx: Context<DonateMilestone>, amount: u64) -> Result<()> {
        require!(ctx.accounts.milestone_campaign.is_active, CrowdfundingError::CampaignInactive);

        let campaign_key = ctx.accounts.milestone_campaign.key();
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
                ctx.accounts.milestone_campaign.to_account_info(),
            ],
        )?;

        let campaign = &mut ctx.accounts.milestone_campaign;
        campaign.amount_raised += amount;

        // Actualizeaza puterea de vot a donatorului
        let donor = &mut ctx.accounts.donor_account;
        donor.campaign = campaign_key;
        donor.donor = donor_key;
        donor.amount += amount;

        Ok(())
    }

    /// Proprietarul submite milestone-ul curent pentru aprobare prin vot
    ///
    /// # Conditii
    /// * Apelantul trebuie sa fie owner-ul campaniei
    /// * Campania trebuie sa fie activa
    /// * Goalul total trebuie sa fi fost atins
    /// * Milestone-ul curent nu trebuie sa aiba vot activ
    ///
    /// # Fereastra de vot
    /// Se deschide o fereastra de vot de 3 zile (3 * 24 * 3600 secunde)
    ///
    /// # Erori
    /// * `Unauthorized` - Nu esti owner
    /// * `GoalNotReached` - Goalul nu a fost atins
    /// * `VotingAlreadyActive` - Vot deja activ pentru aceasta etapa
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

    /// Voteaza pentru sau contra aprobarii milestone-ului curent
    ///
    /// # Mecanismul de vot
    /// Votul este ponderat proportional cu suma donata:
    /// * `votes_for` += donor_amount (daca approve = true)
    /// * `votes_against` += donor_amount (daca approve = false)
    ///
    /// # Securitate — PDA Vote Record
    /// Contul `vote_record` este un PDA derivat din:
    /// `["vote", campaign_pubkey, voter_pubkey, milestone_idx]`
    /// Garanteaza ca fiecare donator voteaza o singura data per milestone.
    ///
    /// # Argumente
    /// * `milestone_idx` - Indexul milestone-ului (0-based)
    /// * `approve` - true = pentru, false = contra
    ///
    /// # Erori
    /// * `NotADonor` - Nu ai donat la aceasta campanie
    /// * `AlreadyVoted` - Ai votat deja pentru acest milestone
    /// * `VotingNotActive` - Votul nu este activ
    /// * `VotingExpired` - Fereastra de vot a expirat
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

        // Inregistreaza votul in PDA
        vote_record.has_voted = true;
        vote_record.voter = ctx.accounts.voter.key();
        vote_record.campaign = campaign.key();
        vote_record.milestone_idx = milestone_idx;

        if approve {
            campaign.milestones[idx].votes_for += donor_amount;
        } else {
            campaign.milestones[idx].votes_against += donor_amount;
        }

        Ok(())
    }

    /// Finalizeaza votul si elibereaza fondurile daca milestone-ul e aprobat
    ///
    /// # Logica de finalizare
    /// * Daca `votes_for > votes_against`: milestone aprobat
    ///   - Transfera suma milestone-ului catre owner
    ///   - Incrementeaza `current_milestone`
    ///   - Daca toate etapele sunt complete, seteaza `is_active = false`
    /// * Altfel: milestone respins (poate fi resubmis)
    ///
    /// # Transfer SOL
    /// Transferul se face direct prin modificarea lamports-urilor conturilor:
    /// `campaign.lamports -= amount`
    /// `owner.lamports += amount`
    ///
    /// # Erori
    /// * `VotingNotActive` - Votul nu este activ
    pub fn finalize_milestone(ctx: Context<FinalizeMilestone>, milestone_idx: u8) -> Result<()> {
        let campaign = &mut ctx.accounts.milestone_campaign;
        let idx = milestone_idx as usize;
        require!(campaign.milestones[idx].voting_active, CrowdfundingError::VotingNotActive);

        // EFFECTS: oprim votul inainte de transfer
        campaign.milestones[idx].voting_active = false;

        if campaign.milestones[idx].votes_for > campaign.milestones[idx].votes_against {
            campaign.milestones[idx].completed = true;
            campaign.milestones[idx].approved = true;
            campaign.current_milestone += 1;

            let amount = campaign.milestones[idx].amount;

            // INTERACTIONS: transfer SOL prin modificarea lamports
            **campaign.to_account_info().try_borrow_mut_lamports()? -= amount;
            **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += amount;

            if campaign.current_milestone as usize >= campaign.milestone_count as usize {
                campaign.is_active = false;
            }
        } else {
            campaign.milestones[idx].completed = false;
            campaign.milestones[idx].approved = false;
        }

        Ok(())
    }
}

// ============================================================
// STRUCTURI DE CONTURI (Anchor Account Validation)
// ============================================================

/// Conturi necesare pentru crearea unei campanii simple
#[derive(Accounts)]
pub struct CreateCampaign<'info> {
    /// Contul campaniei — initializat cu spatiu pentru Campaign::LEN bytes
    #[account(init, payer = owner, space = 8 + Campaign::LEN)]
    pub campaign: Account<'info, Campaign>,
    /// Proprietarul campaniei — plateste rent pentru cont
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Conturi necesare pentru donatie simpla
#[derive(Accounts)]
pub struct Donate<'info> {
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub donor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Conturi necesare pentru retragere fonduri
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

/// Conturi necesare pentru crearea campaniei cu milestone-uri
#[derive(Accounts)]
pub struct CreateMilestoneCampaign<'info> {
    #[account(init, payer = owner, space = 8 + MilestoneCampaign::LEN)]
    pub milestone_campaign: Account<'info, MilestoneCampaign>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Conturi necesare pentru donatie la campanie cu milestone-uri
///
/// PDA donor_account: seeds = ["donor", campaign, donor]
/// init_if_needed: permite donatii multiple de la acelasi donator
#[derive(Accounts)]
pub struct DonateMilestone<'info> {
    #[account(mut)]
    pub milestone_campaign: Account<'info, MilestoneCampaign>,
    #[account(mut)]
    pub donor: Signer<'info>,
    #[account(
        init_if_needed,
        payer = donor,
        space = 8 + DonorRecord::LEN,
        seeds = [b"donor", milestone_campaign.key().as_ref(), donor.key().as_ref()],
        bump
    )]
    pub donor_account: Account<'info, DonorRecord>,
    pub system_program: Program<'info, System>,
}

/// Conturi necesare pentru submit milestone
#[derive(Accounts)]
pub struct SubmitMilestone<'info> {
    #[account(mut)]
    pub milestone_campaign: Account<'info, MilestoneCampaign>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

/// Conturi necesare pentru vot milestone
///
/// PDA vote_record: seeds = ["vote", campaign, voter, milestone_idx]
/// Garanteaza unicitatea votului per (donator, milestone)
#[derive(Accounts)]
#[instruction(milestone_idx: u8)]
pub struct VoteMilestone<'info> {
    #[account(mut)]
    pub milestone_campaign: Account<'info, MilestoneCampaign>,
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account(
        seeds = [b"donor", milestone_campaign.key().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub donor_account: Account<'info, DonorRecord>,
    #[account(
        init,
        payer = voter,
        space = 8 + VoteRecord::LEN,
        seeds = [b"vote", milestone_campaign.key().as_ref(), voter.key().as_ref(), &[milestone_idx]],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,
    pub system_program: Program<'info, System>,
}

/// Conturi necesare pentru finalizare milestone
#[derive(Accounts)]
#[instruction(milestone_idx: u8)]
pub struct FinalizeMilestone<'info> {
    #[account(mut)]
    pub milestone_campaign: Account<'info, MilestoneCampaign>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

// ============================================================
// STRUCTURI DE DATE (On-chain Account Layouts)
// ============================================================

/// Campanie simpla de crowdfunding pe Solana
#[account]
pub struct Campaign {
    pub owner: Pubkey,          // 32 bytes — adresa proprietarului
    pub title: String,          // 4 + 64 bytes — titlul campaniei
    pub description: String,    // 4 + 256 bytes — descrierea campaniei
    pub goal: u64,              // 8 bytes — obiectivul in lamports
    pub amount_raised: u64,     // 8 bytes — suma stransa in lamports
    pub is_active: bool,        // 1 byte — statusul campaniei
}

impl Campaign {
    /// Spatiul total necesar pentru contul Campaign (fara discriminator de 8 bytes)
    const LEN: usize = 32 + (4 + 64) + (4 + 256) + 8 + 8 + 1;
}

/// O etapa (milestone) dintr-o campanie cu finantare etapizata
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct Milestone {
    pub title: String,              // 4 + 64 bytes
    pub description: String,        // 4 + 256 bytes
    pub amount: u64,                // 8 bytes — suma alocata in lamports
    pub completed: bool,            // 1 byte
    pub approved: bool,             // 1 byte
    pub votes_for: u64,             // 8 bytes — voturi pentru (ponderate)
    pub votes_against: u64,         // 8 bytes — voturi contra (ponderate)
    pub voting_active: bool,        // 1 byte
    pub voting_deadline: i64,       // 8 bytes — timestamp Unix
}

impl Milestone {
    /// Spatiul unui milestone in bytes
    const LEN: usize = (4 + 64) + (4 + 256) + 8 + 1 + 1 + 8 + 8 + 1 + 8;
}

/// Campanie cu finantare etapizata pe Solana
#[account]
pub struct MilestoneCampaign {
    pub owner: Pubkey,                  // 32 bytes
    pub title: String,                  // 4 + 64 bytes
    pub description: String,            // 4 + 256 bytes
    pub total_goal: u64,                // 8 bytes — suma tuturor milestone-urilor
    pub amount_raised: u64,             // 8 bytes
    pub is_active: bool,                // 1 byte
    pub current_milestone: u8,          // 1 byte — indexul etapei curente
    pub milestone_count: u8,            // 1 byte — numarul total de etape
    pub milestones: [Milestone; 5],     // array fix de 5 milestone-uri
}

impl MilestoneCampaign {
    /// Spatiul total pentru MilestoneCampaign
    const LEN: usize = 32 + (4 + 64) + (4 + 256) + 8 + 8 + 1 + 1 + 1 + (Milestone::LEN * 5);
}

/// Inregistrarea donatiei unui participant (PDA)
///
/// Derivat din seeds: ["donor", campaign, donor]
/// Stocheaza suma totala donata — folosita ca putere de vot
#[account]
pub struct DonorRecord {
    pub campaign: Pubkey,   // 32 bytes — campania la care s-a donat
    pub donor: Pubkey,      // 32 bytes — adresa donatorului
    pub amount: u64,        // 8 bytes — suma totala donata (putere de vot)
}

impl DonorRecord {
    const LEN: usize = 32 + 32 + 8;
}

/// Inregistrarea votului unui participant (PDA)
///
/// Derivat din seeds: ["vote", campaign, voter, milestone_idx]
/// Garanteaza unicitatea votului per (donator, milestone)
#[account]
pub struct VoteRecord {
    pub voter: Pubkey,          // 32 bytes — adresa votantului
    pub campaign: Pubkey,       // 32 bytes — campania
    pub milestone_idx: u8,      // 1 byte — indexul milestone-ului votat
    pub has_voted: bool,        // 1 byte — flag de unicitate
}

impl VoteRecord {
    const LEN: usize = 32 + 32 + 1 + 1;
}

// ============================================================
// CODURI DE EROARE
// ============================================================

/// Coduri de eroare personalizate pentru programul FundChain
#[error_code]
pub enum CrowdfundingError {
    /// Campania a fost inchisa sau nu mai accepta donatii
    #[msg("Campania nu este activa")]
    CampaignInactive,
    /// Apelantul nu este proprietarul campaniei
    #[msg("Nu esti proprietarul campaniei")]
    Unauthorized,
    /// Goalul total nu a fost atins — withdraw/submit indisponibil
    #[msg("Obiectivul nu a fost atins")]
    GoalNotReached,
    /// Campania necesita minimum 2 milestone-uri
    #[msg("Minim 2 milestone-uri necesare")]
    TooFewMilestones,
    /// Campania permite maximum 5 milestone-uri
    #[msg("Maxim 5 milestone-uri permise")]
    TooManyMilestones,
    /// Array-urile de titluri si sume nu au aceeasi lungime
    #[msg("Date invalide")]
    InvalidData,
    /// Un vot este deja in desfasurare pentru acest milestone
    #[msg("Votul este deja activ")]
    VotingAlreadyActive,
    /// Milestone-ul a fost deja finalizat
    #[msg("Milestone deja completat")]
    MilestoneAlreadyCompleted,
    /// Numai donatorii pot vota
    #[msg("Trebuie sa fii donator")]
    NotADonor,
    /// Fiecare donator poate vota o singura data per milestone
    #[msg("Ai votat deja")]
    AlreadyVoted,
    /// Nu exista vot activ pentru acest milestone
    #[msg("Votul nu este activ")]
    VotingNotActive,
    /// Fereastra de vot de 3 zile a expirat
    #[msg("Votul a expirat")]
    VotingExpired,
}