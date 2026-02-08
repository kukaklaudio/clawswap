import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

const IDL = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../target/idl/clawswap.json"), "utf-8")
);

const PROGRAM_ID = new PublicKey(IDL.address);
const GLOBAL_ID = new BN(1);

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  const keypairPath = path.join(
    process.env.HOME || "",
    ".config/solana/id.json"
  );
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new Program(IDL, provider);

  const [globalPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global"), GLOBAL_ID.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );

  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("Global PDA:", globalPda.toBase58());
  console.log("Authority:", keypair.publicKey.toBase58());

  try {
    // Check if already initialized
    const existing = await (program.account as any).global.fetch(globalPda);
    console.log("✅ Already initialized!");
    console.log("  Need counter:", existing.needCounter.toNumber());
    console.log("  Offer counter:", existing.offerCounter.toNumber());
    console.log("  Deal counter:", existing.dealCounter.toNumber());
    return;
  } catch {
    // Not initialized yet
  }

  console.log("Initializing global state...");
  const tx = await program.methods
    .initialize(GLOBAL_ID)
    .accounts({
      global: globalPda,
      authority: keypair.publicKey,
    })
    .rpc();

  console.log("✅ Initialized! Tx:", tx);
  
  const globalAccount = await (program.account as any).global.fetch(globalPda);
  console.log("  Authority:", globalAccount.authority.toBase58());
  console.log("  Need counter:", globalAccount.needCounter.toNumber());
}

main().catch(console.error);
