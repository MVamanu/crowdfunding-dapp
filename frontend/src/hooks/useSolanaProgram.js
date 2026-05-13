import { useState, useEffect } from "react";
import { Connection } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { SOLANA_RPC_URL } from "../config/chains";

export function useSolanaProgram(wallet) {
  const [program, setProgram] = useState(null);
  const [connection, setConnection] = useState(null);

  useEffect(() => {
    const conn = new Connection(SOLANA_RPC_URL, "confirmed");
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
