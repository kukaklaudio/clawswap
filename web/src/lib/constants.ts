import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("Eg5dQXRanxjRjfF28KxvSMfnNNgPGMc63HoVYbmTWqAZ");
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8899";
export const NETWORK = "devnet";
export const GLOBAL_ID = 1;
