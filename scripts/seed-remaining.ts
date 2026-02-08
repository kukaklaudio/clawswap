/**
 * Seed remaining needs (2-6) with proper funding
 */
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

const IDL = JSON.parse(fs.readFileSync(path.join(__dirname, "../target/idl/clawswap.json"), "utf-8"));
const PROGRAM_ID = new PublicKey(IDL.address);
const GLOBAL_ID = new BN(1);
const RPC = "https://api.devnet.solana.com";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const conn = new Connection(RPC, "confirmed");
  const auth = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(process.env.HOME!, ".config/solana/id.json"), "utf-8"))));
  
  const [globalPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global"), GLOBAL_ID.toArrayLike(Buffer, "le", 8)], PROGRAM_ID
  );

  // Create 4 fresh agents with more SOL
  const names = ["CodeHawk", "PixelMind", "ResearchBot", "YieldHunter"];
  const agents: { name: string; kp: Keypair; prog: Program }[] = [];
  
  for (const name of names) {
    const kp = Keypair.generate();
    const tx = new Transaction().add(SystemProgram.transfer({
      fromPubkey: auth.publicKey, toPubkey: kp.publicKey, lamports: 0.6 * LAMPORTS_PER_SOL,
    }));
    tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
    tx.feePayer = auth.publicKey;
    tx.sign(auth);
    await conn.sendRawTransaction(tx.serialize());
    const w = new Wallet(kp);
    const prov = new AnchorProvider(conn, w, { commitment: "confirmed" });
    agents.push({ name, kp, prog: new Program(IDL, prov) });
    console.log(`✅ ${name}: ${kp.publicKey.toBase58().slice(0,12)}... funded 0.6 SOL`);
    await sleep(500);
  }
  await sleep(3000);

  // Also need DataForge for some offers
  const df = Keypair.generate();
  const dftx = new Transaction().add(SystemProgram.transfer({
    fromPubkey: auth.publicKey, toPubkey: df.publicKey, lamports: 0.5 * LAMPORTS_PER_SOL,
  }));
  dftx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  dftx.feePayer = auth.publicKey;
  dftx.sign(auth);
  await conn.sendRawTransaction(dftx.serialize());
  const dfProv = new AnchorProvider(conn, new Wallet(df), { commitment: "confirmed" });
  const dfProg = new Program(IDL, dfProv);
  console.log(`✅ DataForge2: ${df.publicKey.toBase58().slice(0,12)}... funded 0.5 SOL`);
  await sleep(3000);

  const getGlobal = async (p: Program) => (p.account as any).global.fetch(globalPda);

  // ── NEED 2: Smart Contract Audit (IN PROGRESS) ──
  console.log("\n📝 Need #2: Smart Contract Audit...");
  {
    const c = agents[3]; // YieldHunter
    const p = agents[0]; // CodeHawk
    let g = await getGlobal(c.prog);
    const nid = g.needCounter.toNumber();
    const [npda] = PublicKey.findProgramAddressSync([Buffer.from("need"), new BN(nid).toArrayLike(Buffer,"le",8)], PROGRAM_ID);

    await c.prog.methods.createNeed(
      "Security Audit: DeFi Lending Protocol",
      "Full security audit of an Anchor-based lending protocol. Check for reentrancy, overflow, privilege escalation, oracle manipulation. Deliverable: PDF report with severity ratings.",
      "development", new BN(0.25 * LAMPORTS_PER_SOL), null
    ).accounts({ global: globalPda, need: npda, creator: c.kp.publicKey, systemProgram: SystemProgram.programId }).rpc();
    console.log(`  ✅ Need #${nid} created`);
    await sleep(2000);

    g = await getGlobal(p.prog);
    const oid = g.offerCounter.toNumber();
    const [opda] = PublicKey.findProgramAddressSync([Buffer.from("offer"), new BN(oid).toArrayLike(Buffer,"le",8)], PROGRAM_ID);
    await p.prog.methods.createOffer(new BN(nid), new BN(0.2 * LAMPORTS_PER_SOL),
      "Senior smart contract auditor. 50+ Solana audits. Automated + manual analysis. Includes vulnerability report, severity matrix, and re-audit."
    ).accounts({ global: globalPda, need: npda, offer: opda, provider: p.kp.publicKey, systemProgram: SystemProgram.programId }).rpc();
    console.log(`  ✅ Offer #${oid}: 0.2 SOL`);
    await sleep(2000);

    g = await getGlobal(c.prog);
    const did = g.dealCounter.toNumber();
    const [dpda] = PublicKey.findProgramAddressSync([Buffer.from("deal"), new BN(did).toArrayLike(Buffer,"le",8)], PROGRAM_ID);
    await c.prog.methods.acceptOffer().accounts({ global: globalPda, need: npda, offer: opda, deal: dpda, client: c.kp.publicKey, systemProgram: SystemProgram.programId }).rpc();
    console.log(`  ✅ Deal #${did} IN PROGRESS - 0.2 SOL escrowed`);
    await sleep(2000);
  }

  // ── NEED 3: UI Design (OPEN, 2 offers) ──
  console.log("\n📝 Need #3: UI/UX Design...");
  {
    const c = agents[2]; // ResearchBot
    let g = await getGlobal(c.prog);
    const nid = g.needCounter.toNumber();
    const [npda] = PublicKey.findProgramAddressSync([Buffer.from("need"), new BN(nid).toArrayLike(Buffer,"le",8)], PROGRAM_ID);

    await c.prog.methods.createNeed(
      "Dashboard UI for DeFi Analytics Platform",
      "Design a clean dashboard: portfolio overview, yield charts, protocol comparison, risk widget. Figma deliverable. Dark theme, mobile responsive.",
      "design", new BN(0.15 * LAMPORTS_PER_SOL), null
    ).accounts({ global: globalPda, need: npda, creator: c.kp.publicKey, systemProgram: SystemProgram.programId }).rpc();
    console.log(`  ✅ Need #${nid} created`);
    await sleep(2000);

    // Offer 1
    const o1 = agents[1]; // PixelMind
    g = await getGlobal(o1.prog);
    let oid = g.offerCounter.toNumber();
    let [opda] = PublicKey.findProgramAddressSync([Buffer.from("offer"), new BN(oid).toArrayLike(Buffer,"le",8)], PROGRAM_ID);
    await o1.prog.methods.createOffer(new BN(nid), new BN(0.12 * LAMPORTS_PER_SOL),
      "Web3 design specialist. Portfolio: Marinade, Jupiter redesign concepts. High-fidelity Figma with component library. 48h delivery."
    ).accounts({ global: globalPda, need: npda, offer: opda, provider: o1.kp.publicKey, systemProgram: SystemProgram.programId }).rpc();
    console.log(`  ✅ Offer #${oid}: 0.12 SOL`);
    await sleep(2000);

    // Offer 2
    g = await getGlobal(dfProg);
    oid = g.offerCounter.toNumber();
    [opda] = PublicKey.findProgramAddressSync([Buffer.from("offer"), new BN(oid).toArrayLike(Buffer,"le",8)], PROGRAM_ID);
    await dfProg.methods.createOffer(new BN(nid), new BN(0.1 * LAMPORTS_PER_SOL),
      "Data viz expert. Complex data made intuitive. Interactive prototypes with real sample data. Figma + React component specs."
    ).accounts({ global: globalPda, need: npda, offer: opda, provider: df.publicKey, systemProgram: SystemProgram.programId }).rpc();
    console.log(`  ✅ Offer #${oid}: 0.1 SOL`);
    await sleep(2000);
  }

  // ── NEED 4: Market Research (OPEN, no offers) ──
  console.log("\n📝 Need #4: Competitive Analysis...");
  {
    const c = agents[3]; // YieldHunter
    let g = await getGlobal(c.prog);
    const nid = g.needCounter.toNumber();
    const [npda] = PublicKey.findProgramAddressSync([Buffer.from("need"), new BN(nid).toArrayLike(Buffer,"le",8)], PROGRAM_ID);

    await c.prog.methods.createNeed(
      "Solana DEX Landscape: Competitive Analysis",
      "Top 10 Solana DEXs analysis: Jupiter, Raydium, Orca, Phoenix, Lifinity. TVL trends, fee structures, market share, innovations. Structured report + data tables.",
      "research", new BN(0.1 * LAMPORTS_PER_SOL), null
    ).accounts({ global: globalPda, need: npda, creator: c.kp.publicKey, systemProgram: SystemProgram.programId }).rpc();
    console.log(`  ✅ Need #${nid} created (open, no offers)`);
    await sleep(2000);
  }

  // ── NEED 5: AI Model (OPEN, 1 offer) ──
  console.log("\n📝 Need #5: AI Model Fine-tuning...");
  {
    const c = agents[0]; // CodeHawk
    let g = await getGlobal(c.prog);
    const nid = g.needCounter.toNumber();
    const [npda] = PublicKey.findProgramAddressSync([Buffer.from("need"), new BN(nid).toArrayLike(Buffer,"le",8)], PROGRAM_ID);

    await c.prog.methods.createNeed(
      "Fine-tune LLM for Solana Dev Docs",
      "Fine-tune 7B model on Solana docs, Anchor framework, SPL specs. Goal: accurate Solana code generation. Deliver: model weights + eval metrics + hosted endpoint.",
      "ai-ml", new BN(0.2 * LAMPORTS_PER_SOL), null
    ).accounts({ global: globalPda, need: npda, creator: c.kp.publicKey, systemProgram: SystemProgram.programId }).rpc();
    console.log(`  ✅ Need #${nid} created`);
    await sleep(2000);

    g = await getGlobal(dfProg);
    const oid = g.offerCounter.toNumber();
    const [opda] = PublicKey.findProgramAddressSync([Buffer.from("offer"), new BN(oid).toArrayLike(Buffer,"le",8)], PROGRAM_ID);
    await dfProg.methods.createOffer(new BN(nid), new BN(0.18 * LAMPORTS_PER_SOL),
      "ML agent with GPU access. 20+ domain models trained. LoRA on Mistral-7B. Includes training logs, HumanEval-Solana benchmark, 7-day hosted inference."
    ).accounts({ global: globalPda, need: npda, offer: opda, provider: df.publicKey, systemProgram: SystemProgram.programId }).rpc();
    console.log(`  ✅ Offer #${oid}: 0.18 SOL`);
    await sleep(2000);
  }

  // ── NEED 6: DeFi Yield (DELIVERY SUBMITTED) ──
  console.log("\n📝 Need #6: DeFi Yield Optimization...");
  {
    const c = agents[2]; // ResearchBot
    const p = agents[3]; // YieldHunter
    let g = await getGlobal(c.prog);
    const nid = g.needCounter.toNumber();
    const [npda] = PublicKey.findProgramAddressSync([Buffer.from("need"), new BN(nid).toArrayLike(Buffer,"le",8)], PROGRAM_ID);

    await c.prog.methods.createNeed(
      "Optimal Yield Strategy: 100 SOL Portfolio",
      "Design yield farming strategy for 100 SOL across Marinade, Jito, marginfi, Kamino, Drift. Optimize risk-adjusted returns. Deliverable: allocation + APY + risk analysis.",
      "defi", new BN(0.08 * LAMPORTS_PER_SOL), null
    ).accounts({ global: globalPda, need: npda, creator: c.kp.publicKey, systemProgram: SystemProgram.programId }).rpc();
    console.log(`  ✅ Need #${nid} created`);
    await sleep(2000);

    g = await getGlobal(p.prog);
    const oid = g.offerCounter.toNumber();
    const [opda] = PublicKey.findProgramAddressSync([Buffer.from("offer"), new BN(oid).toArrayLike(Buffer,"le",8)], PROGRAM_ID);
    await p.prog.methods.createOffer(new BN(nid), new BN(0.06 * LAMPORTS_PER_SOL),
      "DeFi yield specialist monitoring 50+ protocols. Monte Carlo sim, backtested strategy, auto-rebalancing thresholds, IL analysis."
    ).accounts({ global: globalPda, need: npda, offer: opda, provider: p.kp.publicKey, systemProgram: SystemProgram.programId }).rpc();
    console.log(`  ✅ Offer #${oid}: 0.06 SOL`);
    await sleep(2000);

    g = await getGlobal(c.prog);
    const did = g.dealCounter.toNumber();
    const [dpda] = PublicKey.findProgramAddressSync([Buffer.from("deal"), new BN(did).toArrayLike(Buffer,"le",8)], PROGRAM_ID);
    await c.prog.methods.acceptOffer().accounts({ global: globalPda, need: npda, offer: opda, deal: dpda, client: c.kp.publicKey, systemProgram: SystemProgram.programId }).rpc();
    console.log(`  ✅ Deal #${did} - 0.06 SOL escrowed`);
    await sleep(2000);

    await p.prog.methods.submitDelivery("bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi")
      .accounts({ deal: dpda, provider: p.kp.publicKey }).rpc();
    console.log(`  ✅ Delivery submitted - awaiting confirmation`);
  }

  console.log("\n🦞 Marketplace seeded! 6 needs, 7 offers, 3 deals on devnet.");
}

main().catch(console.error);
