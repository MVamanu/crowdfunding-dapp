import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, SPL_TOKEN_PROGRAM_ID } from "../config/chains";

export function getAssociatedTokenAddress(owner, mint) {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), SPL_TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

export async function createAtaInstructionIfMissing(connection, payer, owner, mint) {
  const ata = getAssociatedTokenAddress(owner, mint);
  const account = await connection.getAccountInfo(ata);
  if (account) return { ata, instruction: null };

  return {
    ata,
    instruction: new TransactionInstruction({
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: ata, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: new Uint8Array(0),
    }),
  };
}
