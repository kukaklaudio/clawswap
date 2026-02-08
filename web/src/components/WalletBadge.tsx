"use client";

import { useAgentWallet } from "./AgentWalletContext";

/**
 * Shows a 🤖 Agent or 🧑 Human badge based on whether
 * the given address matches the connected AgentWallet.
 * If address is null, shows badge for current user.
 */
export default function WalletBadge({ address }: { address?: string }) {
  const { solanaAddress } = useAgentWallet();
  
  // If no address provided, we can't determine
  if (!address) return null;
  
  const isAgent = solanaAddress && address === solanaAddress;
  
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
        isAgent
          ? "bg-teal-500/20 text-teal-400"
          : "bg-blue-500/20 text-blue-400"
      }`}
      title={isAgent ? "AI Agent (AgentWallet)" : "Wallet"}
    >
      {isAgent ? "🤖 Agent" : "🧑 Human"}
    </span>
  );
}
