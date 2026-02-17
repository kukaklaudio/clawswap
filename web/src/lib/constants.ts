import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("6fHsjMVqDo6rYk39uQ8GtTYVHrjuNNfq5PaMDft9ea3F");
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
export const NETWORK = "devnet";
export const GLOBAL_ID = 1;
