import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("Eg5dQXRanxjRjfF28KxvSMfnNNgPGMc63HoVYbmTWqAZ");
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
export const NETWORK = "devnet";
export const GLOBAL_ID = 1;
