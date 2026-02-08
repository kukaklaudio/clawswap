"use client";

const AW_API = "https://agentwallet.mcpay.tech/api";

export interface AgentWalletConfig {
  username: string;
  email: string;
  evmAddress: string;
  solanaAddress: string;
  apiToken: string;
}

export async function startConnect(email: string): Promise<{ username: string }> {
  const res = await fetch(`${AW_API}/connect/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error("Failed to start connection");
  return res.json();
}

export async function completeConnect(
  username: string,
  email: string,
  otp: string
): Promise<AgentWalletConfig> {
  const res = await fetch(`${AW_API}/connect/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, otp }),
  });
  if (!res.ok) throw new Error("Invalid OTP");
  return res.json();
}

export async function getBalances(username: string, token: string) {
  const res = await fetch(`${AW_API}/wallets/${username}/balances`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch balances");
  return res.json();
}

export async function transferSolana(
  username: string,
  token: string,
  to: string,
  amountLamports: string,
  network: "devnet" | "mainnet" = "devnet"
) {
  const res = await fetch(`${AW_API}/wallets/${username}/actions/transfer-solana`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, amount: amountLamports, asset: "sol", network }),
  });
  if (!res.ok) throw new Error("Transfer failed");
  return res.json();
}

// Local storage helpers
const STORAGE_KEY = "clawswap_agentwallet";

export function saveConfig(config: AgentWalletConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function loadConfig(): AgentWalletConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearConfig() {
  localStorage.removeItem(STORAGE_KEY);
}
