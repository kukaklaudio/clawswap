/**
 * ClawSwap Agent-to-Agent Simulation
 * 
 * Simulates two AI agents:
 * - Agent A (Client): Needs code review for a Solana smart contract
 * - Agent B (Provider): Offers code review services
 * 
 * Full flow: Create Need → Create Offer → Accept → Deliver → Confirm → Payment
 */

import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

const IDL = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../target/idl/clawswap.json"), "utf-8")
);

const PROGRAM_ID = new PublicKey(IDL.address);
const GLOBAL_ID = new BN(1);
const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";

// Colors for terminal output
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const BLUE = "\x1b[34m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const DIM = "\x1b[2m";

function log(agent: string, color: string, msg: string) {
  const prefix = agent === "A" ? `${BLUE}🤖 Agent A (Client)${RESET}` : `${MAGENTA}🦾 Agent B (Provider)${RESET}`;
  console.log(`${prefix} ${DIM}│${RESET} ${msg}`);
}

function header(msg: string) {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  ${msg}${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════${RESET}\n`);
}

function step(num: number, msg: string) {
  console.log(`\n${YELLOW}━━━ Step ${num}: ${msg} ━━━${RESET}\n`);
}

function success(msg: string) {
  console.log(`${GREEN}  ✅ ${msg}${RESET}`);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  header("🦞 ClawSwap Agent-to-Agent Simulation");
  
  const connection = new Connection(RPC_URL, "confirmed");
  
  // Load authority keypair (for funding)
  const keypairPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  const authorityKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
  );

  // Create two agent keypairs
  const agentA = Keypair.generate(); // Client
  const agentB = Keypair.generate(); // Provider

  console.log(`${DIM}Program ID: ${PROGRAM_ID.toBase58()}${RESET}`);
  console.log(`${DIM}Network: ${RPC_URL}${RESET}`);
  console.log(`${BLUE}Agent A (Client):   ${agentA.publicKey.toBase58()}${RESET}`);
  console.log(`${MAGENTA}Agent B (Provider): ${agentB.publicKey.toBase58()}${RESET}`);

  // ── Fund agents ──
  step(0, "Funding agent wallets");
  
  const fundAmount = 0.5 * LAMPORTS_PER_SOL;
  
  // Fund Agent A
  const fundATx = new (await import("@solana/web3.js")).Transaction().add(
    SystemProgram.transfer({
      fromPubkey: authorityKeypair.publicKey,
      toPubkey: agentA.publicKey,
      lamports: fundAmount,
    })
  );
  fundATx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  fundATx.feePayer = authorityKeypair.publicKey;
  fundATx.sign(authorityKeypair);
  await connection.sendRawTransaction(fundATx.serialize());
  
  // Fund Agent B
  const fundBTx = new (await import("@solana/web3.js")).Transaction().add(
    SystemProgram.transfer({
      fromPubkey: authorityKeypair.publicKey,
      toPubkey: agentB.publicKey,
      lamports: fundAmount,
    })
  );
  fundBTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  fundBTx.feePayer = authorityKeypair.publicKey;
  fundBTx.sign(authorityKeypair);
  await connection.sendRawTransaction(fundBTx.serialize());
  
  await sleep(2000);
  
  const balA = await connection.getBalance(agentA.publicKey);
  const balB = await connection.getBalance(agentB.publicKey);
  log("A", BLUE, `Balance: ${balA / LAMPORTS_PER_SOL} SOL`);
  log("B", MAGENTA, `Balance: ${balB / LAMPORTS_PER_SOL} SOL`);
  success("Both agents funded");

  // ── Setup programs ──
  const walletA = new Wallet(agentA);
  const walletB = new Wallet(agentB);
  const providerA = new AnchorProvider(connection, walletA, { commitment: "confirmed" });
  const providerB = new AnchorProvider(connection, walletB, { commitment: "confirmed" });
  const programA = new Program(IDL, providerA);
  const programB = new Program(IDL, providerB);

  const [globalPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global"), GLOBAL_ID.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );

  // ── Step 1: Agent A posts a need ──
  step(1, "Agent A posts a need on ClawSwap");
  
  log("A", BLUE, `"I need an AI agent to analyze sentiment of 500 tweets about Solana"`);
  log("A", BLUE, `Budget: 0.1 SOL | Category: data | Deadline: none`);

  const globalAccount = await (programA.account as any).global.fetch(globalPda);
  const needId = globalAccount.needCounter.toNumber();
  const [needPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("need"), new BN(needId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );

  const createNeedTx = await programA.methods
    .createNeed(
      "Sentiment Analysis: 500 Solana Tweets",
      "Need an AI agent to analyze sentiment (positive/negative/neutral) of 500 recent tweets about Solana ecosystem. Output as JSON with tweet_id, text, sentiment, confidence_score.",
      "data",
      new BN(0.1 * LAMPORTS_PER_SOL),
      null
    )
    .accounts({
      global: globalPda,
      need: needPda,
      creator: agentA.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  success(`Need #${needId} created! Tx: ${createNeedTx.slice(0, 20)}...`);
  await sleep(2000);

  // ── Step 2: Agent B discovers and makes an offer ──
  step(2, "Agent B discovers the need and makes an offer");

  log("B", MAGENTA, `"Scanning marketplace for data analysis opportunities..."`);
  log("B", MAGENTA, `"Found Need #${needId}: Sentiment Analysis. I can do this!"`);
  log("B", MAGENTA, `"Offering to do it for 0.08 SOL (20% below budget)"`);

  const globalAccount2 = await (programB.account as any).global.fetch(globalPda);
  const offerId = globalAccount2.offerCounter.toNumber();
  const [offerPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("offer"), new BN(offerId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );

  const createOfferTx = await programB.methods
    .createOffer(
      new BN(needId),
      new BN(0.08 * LAMPORTS_PER_SOL),
      "I'm a specialized NLP agent with 99.2% accuracy on sentiment classification. Can deliver within 1 hour. I use a fine-tuned model on crypto-specific language."
    )
    .accounts({
      global: globalPda,
      need: needPda,
      offer: offerPda,
      provider: agentB.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  success(`Offer #${offerId} created! Price: 0.08 SOL | Tx: ${createOfferTx.slice(0, 20)}...`);
  await sleep(2000);

  // ── Step 3: Agent A evaluates and accepts ──
  step(3, "Agent A evaluates the offer and accepts");

  log("A", BLUE, `"Reviewing offer from ${agentB.publicKey.toBase58().slice(0, 8)}..."`);
  log("A", BLUE, `"99.2% accuracy, crypto-specialized, under budget. Accepting!"`);
  log("A", BLUE, `"Escrowing 0.08 SOL into smart contract..."`);

  const globalAccount3 = await (programA.account as any).global.fetch(globalPda);
  const dealId = globalAccount3.dealCounter.toNumber();
  const [dealPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("deal"), new BN(dealId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );

  const acceptTx = await programA.methods
    .acceptOffer()
    .accounts({
      global: globalPda,
      need: needPda,
      offer: offerPda,
      deal: dealPda,
      client: agentA.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  success(`Deal #${dealId} created! Escrow: 0.08 SOL locked | Tx: ${acceptTx.slice(0, 20)}...`);
  
  const balAAfterEscrow = await connection.getBalance(agentA.publicKey);
  log("A", BLUE, `Balance after escrow: ${(balAAfterEscrow / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  await sleep(2000);

  // ── Step 4: Agent B delivers ──
  step(4, "Agent B completes the work and submits delivery");

  log("B", MAGENTA, `"Processing 500 tweets through NLP pipeline..."`);
  log("B", MAGENTA, `"Analysis complete. 312 positive, 128 neutral, 60 negative."`);
  log("B", MAGENTA, `"Uploading results to IPFS and submitting delivery hash..."`);

  const deliveryHash = "QmX7bF3jK9mN2pL4qR8sT6uV5wY1zA3bC4dE5fG6hJ7kM";

  const deliverTx = await programB.methods
    .submitDelivery(deliveryHash)
    .accounts({
      deal: dealPda,
      provider: agentB.publicKey,
    })
    .rpc();

  success(`Delivery submitted! IPFS: ${deliveryHash.slice(0, 20)}... | Tx: ${deliverTx.slice(0, 20)}...`);
  await sleep(2000);

  // ── Step 5: Agent A confirms and payment releases ──
  step(5, "Agent A verifies delivery and confirms");

  log("A", BLUE, `"Downloading results from IPFS: ${deliveryHash.slice(0, 20)}..."`);
  log("A", BLUE, `"Validating: 500 tweets analyzed ✓, JSON format ✓, confidence scores ✓"`);
  log("A", BLUE, `"Quality check passed. Confirming delivery and releasing payment..."`);

  const balBBefore = await connection.getBalance(agentB.publicKey);

  const confirmTx = await programA.methods
    .confirmDelivery()
    .accounts({
      deal: dealPda,
      need: needPda,
      client: agentA.publicKey,
      provider: agentB.publicKey,
    })
    .rpc();

  success(`Delivery confirmed! Payment released! Tx: ${confirmTx.slice(0, 20)}...`);
  await sleep(2000);

  // ── Final State ──
  header("📊 Final State");

  const balAFinal = await connection.getBalance(agentA.publicKey);
  const balBFinal = await connection.getBalance(agentB.publicKey);

  log("A", BLUE, `Final balance: ${(balAFinal / LAMPORTS_PER_SOL).toFixed(4)} SOL (started with 0.5)`);
  log("B", MAGENTA, `Final balance: ${(balBFinal / LAMPORTS_PER_SOL).toFixed(4)} SOL (started with 0.5)`);

  const payment = (balBFinal - balBBefore) / LAMPORTS_PER_SOL;
  console.log(`\n${GREEN}${BOLD}  💰 Payment transferred: ${payment.toFixed(4)} SOL${RESET}`);

  // Fetch final on-chain state
  const finalNeed = await (programA.account as any).need.fetch(needPda);
  const finalDeal = await (programA.account as any).deal.fetch(dealPda);
  
  console.log(`\n${DIM}  On-chain state:${RESET}`);
  console.log(`${DIM}  Need #${needId}: ${Object.keys(finalNeed.status)[0]}${RESET}`);
  console.log(`${DIM}  Deal #${dealId}: ${Object.keys(finalDeal.status)[0]}${RESET}`);
  console.log(`${DIM}  Delivery hash: ${finalDeal.deliveryHash}${RESET}`);

  header("🎉 Simulation Complete!");
  console.log(`${BOLD}Two AI agents successfully traded capabilities on Solana.${RESET}`);
  console.log(`${DIM}No intermediaries. No trust required. Just code.${RESET}\n`);
}

main().catch(console.error);
