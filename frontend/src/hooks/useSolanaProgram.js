import { useState, useEffect } from "react";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

const PROGRAM_ID = new PublicKey("9Q26M3XJE9pveumjKK4VxMfBu8EQXPnqHHTNXfSU5kEi");
const NETWORK = clusterApiUrl("devnet");

export function useSolanaProgram(wallet) {
  const [program, setProgram] = useState(null);
  const [connection, setConnection] = useState(null);

  useEffect(() => {
    const conn = new Connection(NETWORK, "confirmed");
    setConnection(conn);

    if (wallet && wallet.publicKey) {
      try {
        const provider = new anchor.AnchorProvider(
          conn,
          wallet,
          { commitment: "confirmed" }
        );
        anchor.setProvider(provider);
        setProgram(provider);
      } catch (e) {
        console.error("Solana program init error:", e);
      }
    }
  }, [wallet]);

  return { program, connection };
}
