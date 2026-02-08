import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Clawswap } from "../target/types/clawswap";
import { expect } from "chai";

describe("clawswap", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Clawswap as Program<Clawswap>;
  
  // Test accounts
  const globalId = new anchor.BN(1);
  const authority = provider.wallet as anchor.Wallet;
  const creator = anchor.web3.Keypair.generate();
  const providerAccount = anchor.web3.Keypair.generate();
  
  let globalPda: anchor.web3.PublicKey;
  let needPda: anchor.web3.PublicKey;
  let offerPda: anchor.web3.PublicKey;
  let dealPda: anchor.web3.PublicKey;

  before(async () => {
    // Airdrop SOL to test accounts
    await provider.connection.requestAirdrop(creator.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(providerAccount.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
    
    // Find PDAs
    [globalPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("global"), globalId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
  });

  it("Initialize global state", async () => {
    try {
      const tx = await program.methods
        .initialize(globalId)
        .accounts({
          global: globalPda,
          authority: authority.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log("Initialize tx signature:", tx);

      // Check global state
      const globalAccount = await program.account.global.fetch(globalPda);
      expect(globalAccount.authority.toString()).to.equal(authority.publicKey.toString());
      expect(globalAccount.needCounter.toNumber()).to.equal(0);
    } catch (error) {
      console.error("Initialize error:", error);
      throw error;
    }
  });

  it("Create a need", async () => {
    const needId = new anchor.BN(0);
    [needPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("need"), needId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    try {
      const tx = await program.methods
        .createNeed(
          "AI Code Review",
          "Need someone to review my Rust smart contract code for security vulnerabilities",
          "development",
          new anchor.BN(0.1 * anchor.web3.LAMPORTS_PER_SOL), // 0.1 SOL budget
          null
        )
        .accounts({
          global: globalPda,
          need: needPda,
          creator: creator.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      console.log("Create need tx signature:", tx);

      // Check need account
      const needAccount = await program.account.need.fetch(needPda);
      expect(needAccount.id.toNumber()).to.equal(0);
      expect(needAccount.creator.toString()).to.equal(creator.publicKey.toString());
      expect(needAccount.title).to.equal("AI Code Review");
      expect(needAccount.status).to.deep.equal({ open: {} });
    } catch (error) {
      console.error("Create need error:", error);
      throw error;
    }
  });

  it("Create an offer", async () => {
    const offerId = new anchor.BN(0);
    [offerPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("offer"), offerId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    try {
      const tx = await program.methods
        .createOffer(
          new anchor.BN(0), // need_id
          new anchor.BN(0.05 * anchor.web3.LAMPORTS_PER_SOL), // 0.05 SOL price
          "I'm an expert Rust developer. Can deliver within 24h."
        )
        .accounts({
          global: globalPda,
          need: needPda,
          offer: offerPda,
          provider: providerAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([providerAccount])
        .rpc();

      console.log("Create offer tx signature:", tx);

      // Check offer account
      const offerAccount = await program.account.offer.fetch(offerPda);
      expect(offerAccount.id.toNumber()).to.equal(0);
      expect(offerAccount.needId.toNumber()).to.equal(0);
      expect(offerAccount.provider.toString()).to.equal(providerAccount.publicKey.toString());
      expect(offerAccount.status).to.deep.equal({ pending: {} });
    } catch (error) {
      console.error("Create offer error:", error);
      throw error;
    }
  });

  it("Accept offer and create deal", async () => {
    const dealId = new anchor.BN(0);
    [dealPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("deal"), dealId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    try {
      const tx = await program.methods
        .acceptOffer()
        .accounts({
          global: globalPda,
          need: needPda,
          offer: offerPda,
          deal: dealPda,
          client: creator.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      console.log("Accept offer tx signature:", tx);

      // Check deal account
      const dealAccount = await program.account.deal.fetch(dealPda);
      expect(dealAccount.id.toNumber()).to.equal(0);
      expect(dealAccount.client.toString()).to.equal(creator.publicKey.toString());
      expect(dealAccount.provider.toString()).to.equal(providerAccount.publicKey.toString());
      expect(dealAccount.status).to.deep.equal({ inProgress: {} });

      // Check need status updated
      const needAccount = await program.account.need.fetch(needPda);
      expect(needAccount.status).to.deep.equal({ inProgress: {} });
    } catch (error) {
      console.error("Accept offer error:", error);
      throw error;
    }
  });

  it("Submit delivery", async () => {
    try {
      const tx = await program.methods
        .submitDelivery("QmXxX123...") // IPFS hash mock
        .accounts({
          deal: dealPda,
          provider: providerAccount.publicKey,
        })
        .signers([providerAccount])
        .rpc();

      console.log("Submit delivery tx signature:", tx);

      // Check deal status updated
      const dealAccount = await program.account.deal.fetch(dealPda);
      expect(dealAccount.status).to.deep.equal({ deliverySubmitted: {} });
      expect(dealAccount.deliveryHash).to.equal("QmXxX123...");
    } catch (error) {
      console.error("Submit delivery error:", error);
      throw error;
    }
  });

  it("Confirm delivery and complete deal", async () => {
    try {
      const providerBalanceBefore = await provider.connection.getBalance(providerAccount.publicKey);
      
      const tx = await program.methods
        .confirmDelivery()
        .accounts({
          deal: dealPda,
          need: needPda,
          client: creator.publicKey,
          provider: providerAccount.publicKey,
        })
        .signers([creator])
        .rpc();

      console.log("Confirm delivery tx signature:", tx);

      // Check need status updated  
      const needAccount = await program.account.need.fetch(needPda);
      expect(needAccount.status).to.deep.equal({ completed: {} });

      // Check provider received payment
      const providerBalanceAfter = await provider.connection.getBalance(providerAccount.publicKey);
      expect(providerBalanceAfter).to.be.greaterThan(providerBalanceBefore);
      console.log(`Provider balance: ${providerBalanceBefore / 1e9} -> ${providerBalanceAfter / 1e9} SOL`);

      // Deal account may be closed after draining lamports — that's expected
      const dealInfo = await provider.connection.getAccountInfo(dealPda);
      console.log(`Deal account exists: ${dealInfo !== null}`);
    } catch (error) {
      console.error("Confirm delivery error:", error);
      throw error;
    }
  });
});