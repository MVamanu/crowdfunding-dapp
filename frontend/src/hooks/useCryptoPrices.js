import { useState, useEffect } from "react";

export function useCryptoPrices() {
  const [prices, setPrices] = useState({ eth: 0, sol: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPrices() {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,solana&vs_currencies=usd"
        );
        const data = await res.json();
        setPrices({
          eth: data.ethereum?.usd || 0,
          sol: data.solana?.usd || 0,
        });
      } catch (e) {
        console.error("Price fetch error:", e);
        setPrices({ eth: 2500, sol: 150 });
      }
      setLoading(false);
    }
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  function toUSD(amount, blockchain) {
    const value = blockchain === "sol"
      ? (Number(amount) / 1e9) * prices.sol
      : (Number(amount) / 1e18) * prices.eth;
    return value.toFixed(2);
  }

  function formatUSD(amount, blockchain) {
    const usd = toUSD(amount, blockchain);
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(usd);
  }

  return { prices, loading, toUSD, formatUSD };
}
