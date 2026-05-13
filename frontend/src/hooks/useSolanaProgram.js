import { useState, useEffect } from "react";
import { Connection } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { SOLANA_RPC_URL } from "../config/chains";

export function useSolanaProgram(wallet) {
  const [program, setProgram] = useState(null);
  const [connection] = useState(() => new Connection(SOLANA_RPC_URL, "confirmed"));

  useEffect(() => {
    queueMicrotask(() => {
      if (!wallet?.publicKey) return;
      try {
        const provider = new anchor.AnchorProvider(
          connection,
          wallet,
          { commitment: "confirmed" }
        );
        anchor.setProvider(provider);
        setProgram(provider);
      } catch (e) {
        console.error("Solana program init error:", e);
      }
    });
  }, [connection, wallet]);

  return { program, connection };
}
