import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import idl from "./idl/clawswap.json";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "*", credentials: true }));
app.use(express.json({ limit: "10mb" }));

// Solana setup
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");
const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID || idl.address
);

// Dummy wallet for read-only operations
const dummyKeypair = Keypair.generate();
const dummyWallet = new Wallet(dummyKeypair);
const provider = new AnchorProvider(connection, dummyWallet, {
  commitment: "confirmed",
});
const program = new Program(idl as any, provider);

// ---- Helpers ----

function findGlobalPda(globalId: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global"), new BN(globalId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  return pda;
}

function findNeedPda(needId: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("need"), new BN(needId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  return pda;
}

function findOfferPda(offerId: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("offer"), new BN(offerId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  return pda;
}

function findDealPda(dealId: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("deal"), new BN(dealId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
  return pda;
}

function serializeAccount(account: any): any {
  const serialized: any = {};
  for (const [key, value] of Object.entries(account)) {
    if (value instanceof PublicKey) {
      serialized[key] = value.toBase58();
    } else if (value instanceof BN) {
      serialized[key] = value.toNumber();
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      // Enum — return key name
      const keys = Object.keys(value as any);
      if (keys.length === 1 && typeof (value as any)[keys[0]] === "object") {
        serialized[key] = keys[0];
      } else {
        serialized[key] = value;
      }
    } else {
      serialized[key] = value;
    }
  }
  return serialized;
}

// ---- Health ----

app.get("/health", async (_req, res) => {
  try {
    const slot = await connection.getSlot();
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      network: RPC_URL,
      slot,
      programId: PROGRAM_ID.toBase58(),
    });
  } catch (error) {
    res.json({ status: "degraded", error: String(error) });
  }
});

// ---- Global State ----

app.get("/api/global/:id", async (req, res) => {
  try {
    const globalPda = findGlobalPda(parseInt(req.params.id));
    const account = await (program.account as any).global.fetch(globalPda);
    res.json({ success: true, data: serializeAccount(account), pda: globalPda.toBase58() });
  } catch (error: any) {
    res.status(404).json({ success: false, error: "Global state not found" });
  }
});

// ---- Needs ----

app.get("/api/needs", async (req, res) => {
  try {
    const accounts = await (program.account as any).need.all();
    const needs = accounts.map((a: any) => ({
      publicKey: a.publicKey.toBase58(),
      ...serializeAccount(a.account),
    }));
    
    // Filter by status if provided
    const status = req.query.status as string;
    const filtered = status
      ? needs.filter((n: any) => n.status === status)
      : needs;

    res.json({ success: true, data: filtered, count: filtered.length });
  } catch (error: any) {
    console.error("Error fetching needs:", error);
    res.status(500).json({ success: false, error: "Failed to fetch needs" });
  }
});

app.get("/api/needs/:id", async (req, res) => {
  try {
    const needId = parseInt(req.params.id);
    const needPda = findNeedPda(needId);
    const account = await (program.account as any).need.fetch(needPda);
    res.json({
      success: true,
      data: { publicKey: needPda.toBase58(), ...serializeAccount(account) },
    });
  } catch (error: any) {
    res.status(404).json({ success: false, error: "Need not found" });
  }
});

// Get needs by creator
app.get("/api/needs/creator/:publicKey", async (req, res) => {
  try {
    const creatorPubkey = new PublicKey(req.params.publicKey);
    const accounts = await (program.account as any).need.all([
      { memcmp: { offset: 16, bytes: creatorPubkey.toBase58() } },
    ]);
    const needs = accounts.map((a: any) => ({
      publicKey: a.publicKey.toBase58(),
      ...serializeAccount(a.account),
    }));
    res.json({ success: true, data: needs, count: needs.length });
  } catch (error: any) {
    console.error("Error fetching needs by creator:", error);
    res.status(500).json({ success: false, error: "Failed to fetch needs" });
  }
});

// ---- Offers ----

app.get("/api/offers", async (req, res) => {
  try {
    const accounts = await (program.account as any).offer.all();
    const offers = accounts.map((a: any) => ({
      publicKey: a.publicKey.toBase58(),
      ...serializeAccount(a.account),
    }));
    
    const needId = req.query.needId as string;
    const filtered = needId
      ? offers.filter((o: any) => o.needId === parseInt(needId))
      : offers;

    res.json({ success: true, data: filtered, count: filtered.length });
  } catch (error: any) {
    console.error("Error fetching offers:", error);
    res.status(500).json({ success: false, error: "Failed to fetch offers" });
  }
});

app.get("/api/offers/:id", async (req, res) => {
  try {
    const offerId = parseInt(req.params.id);
    const offerPda = findOfferPda(offerId);
    const account = await (program.account as any).offer.fetch(offerPda);
    res.json({
      success: true,
      data: { publicKey: offerPda.toBase58(), ...serializeAccount(account) },
    });
  } catch (error: any) {
    res.status(404).json({ success: false, error: "Offer not found" });
  }
});

// Get offers by provider
app.get("/api/offers/provider/:publicKey", async (req, res) => {
  try {
    const providerPubkey = new PublicKey(req.params.publicKey);
    const accounts = await (program.account as any).offer.all([
      { memcmp: { offset: 24, bytes: providerPubkey.toBase58() } },
    ]);
    const offers = accounts.map((a: any) => ({
      publicKey: a.publicKey.toBase58(),
      ...serializeAccount(a.account),
    }));
    res.json({ success: true, data: offers, count: offers.length });
  } catch (error: any) {
    console.error("Error fetching offers by provider:", error);
    res.status(500).json({ success: false, error: "Failed to fetch offers" });
  }
});

// ---- Deals ----

app.get("/api/deals", async (req, res) => {
  try {
    const accounts = await (program.account as any).deal.all();
    const deals = accounts.map((a: any) => ({
      publicKey: a.publicKey.toBase58(),
      ...serializeAccount(a.account),
    }));
    res.json({ success: true, data: deals, count: deals.length });
  } catch (error: any) {
    console.error("Error fetching deals:", error);
    res.status(500).json({ success: false, error: "Failed to fetch deals" });
  }
});

app.get("/api/deals/:id", async (req, res) => {
  try {
    const dealId = parseInt(req.params.id);
    const dealPda = findDealPda(dealId);
    const account = await (program.account as any).deal.fetch(dealPda);
    res.json({
      success: true,
      data: { publicKey: dealPda.toBase58(), ...serializeAccount(account) },
    });
  } catch (error: any) {
    res.status(404).json({ success: false, error: "Deal not found" });
  }
});

// Get deals by user (as client or provider)
app.get("/api/deals/user/:publicKey", async (req, res) => {
  try {
    const userPubkey = new PublicKey(req.params.publicKey);
    const allDeals = await (program.account as any).deal.all();
    const deals = allDeals
      .filter(
        (a: any) =>
          a.account.client.toBase58() === userPubkey.toBase58() ||
          a.account.provider.toBase58() === userPubkey.toBase58()
      )
      .map((a: any) => ({
        publicKey: a.publicKey.toBase58(),
        ...serializeAccount(a.account),
      }));
    res.json({ success: true, data: deals, count: deals.length });
  } catch (error: any) {
    console.error("Error fetching deals by user:", error);
    res.status(500).json({ success: false, error: "Failed to fetch deals" });
  }
});

// ---- Transaction Builder ----
// Returns unsigned transaction instructions for the frontend to sign

app.post("/api/tx/create-need", async (req, res) => {
  try {
    const { creator, title, description, category, budgetLamports, deadline, globalId } = req.body;
    
    if (!creator || !title || !description || !category || !budgetLamports) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const globalPda = findGlobalPda(globalId || 1);
    const globalAccount = await (program.account as any).global.fetch(globalPda);
    const needPda = findNeedPda(globalAccount.needCounter.toNumber());

    const ix = await program.methods
      .createNeed(title, description, category, new BN(budgetLamports), deadline ? new BN(deadline) : null)
      .accounts({
        global: globalPda,
        need: needPda,
        creator: new PublicKey(creator),
        systemProgram: PublicKey.default,
      })
      .instruction();

    res.json({
      success: true,
      data: {
        instruction: ix,
        needPda: needPda.toBase58(),
        needId: globalAccount.needCounter.toNumber(),
      },
    });
  } catch (error: any) {
    console.error("Error building create-need tx:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/tx/create-offer", async (req, res) => {
  try {
    const { provider: providerKey, needId, priceLamports, message, globalId } = req.body;
    
    if (!providerKey || needId === undefined || !priceLamports || !message) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const globalPda = findGlobalPda(globalId || 1);
    const globalAccount = await (program.account as any).global.fetch(globalPda);
    const needPda = findNeedPda(needId);
    const offerPda = findOfferPda(globalAccount.offerCounter.toNumber());

    const ix = await program.methods
      .createOffer(new BN(needId), new BN(priceLamports), message)
      .accounts({
        global: globalPda,
        need: needPda,
        offer: offerPda,
        provider: new PublicKey(providerKey),
        systemProgram: PublicKey.default,
      })
      .instruction();

    res.json({
      success: true,
      data: {
        instruction: ix,
        offerPda: offerPda.toBase58(),
        offerId: globalAccount.offerCounter.toNumber(),
      },
    });
  } catch (error: any) {
    console.error("Error building create-offer tx:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/tx/accept-offer", async (req, res) => {
  try {
    const { client, needId, offerId, globalId } = req.body;
    
    if (!client || needId === undefined || offerId === undefined) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const globalPda = findGlobalPda(globalId || 1);
    const globalAccount = await (program.account as any).global.fetch(globalPda);
    const needPda = findNeedPda(needId);
    const offerPda = findOfferPda(offerId);
    const dealPda = findDealPda(globalAccount.dealCounter.toNumber());

    const ix = await program.methods
      .acceptOffer()
      .accounts({
        global: globalPda,
        need: needPda,
        offer: offerPda,
        deal: dealPda,
        client: new PublicKey(client),
        systemProgram: PublicKey.default,
      })
      .instruction();

    res.json({
      success: true,
      data: {
        instruction: ix,
        dealPda: dealPda.toBase58(),
        dealId: globalAccount.dealCounter.toNumber(),
      },
    });
  } catch (error: any) {
    console.error("Error building accept-offer tx:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/tx/submit-delivery", async (req, res) => {
  try {
    const { provider: providerKey, dealId, deliveryHash } = req.body;
    
    if (!providerKey || dealId === undefined || !deliveryHash) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const dealPda = findDealPda(dealId);

    const ix = await program.methods
      .submitDelivery(deliveryHash)
      .accounts({
        deal: dealPda,
        provider: new PublicKey(providerKey),
      })
      .instruction();

    res.json({ success: true, data: { instruction: ix } });
  } catch (error: any) {
    console.error("Error building submit-delivery tx:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/tx/confirm-delivery", async (req, res) => {
  try {
    const { client, dealId, needId, provider: providerKey } = req.body;
    
    if (!client || dealId === undefined || needId === undefined || !providerKey) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const dealPda = findDealPda(dealId);
    const needPda = findNeedPda(needId);

    const ix = await program.methods
      .confirmDelivery()
      .accounts({
        deal: dealPda,
        need: needPda,
        client: new PublicKey(client),
        provider: new PublicKey(providerKey),
      })
      .instruction();

    res.json({ success: true, data: { instruction: ix } });
  } catch (error: any) {
    console.error("Error building confirm-delivery tx:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---- Stats ----

app.get("/api/stats", async (_req, res) => {
  try {
    const [needs, offers, deals] = await Promise.all([
      (program.account as any).need.all(),
      (program.account as any).offer.all(),
      (program.account as any).deal.all(),
    ]);

    const totalVolume = deals.reduce(
      (sum: number, d: any) => sum + d.account.amountLamports.toNumber(),
      0
    );

    const completedDeals = deals.filter(
      (d: any) => Object.keys(d.account.status)[0] === "completed"
    ).length;

    res.json({
      success: true,
      data: {
        totalNeeds: needs.length,
        openNeeds: needs.filter((n: any) => Object.keys(n.account.status)[0] === "open").length,
        totalOffers: offers.length,
        totalDeals: deals.length,
        completedDeals,
        totalVolumeLamports: totalVolume,
        totalVolumeSol: totalVolume / 1e9,
      },
    });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

// ---- Profile ----

app.get("/api/profile/:address", async (req, res) => {
  try {
    const address = req.params.address;
    const userPubkey = new PublicKey(address);

    const [allNeeds, allOffers, allDeals] = await Promise.all([
      (program.account as any).need.all(),
      (program.account as any).offer.all(),
      (program.account as any).deal.all(),
    ]);

    const needs = allNeeds
      .filter((a: any) => a.account.creator.toBase58() === address)
      .map((a: any) => ({ publicKey: a.publicKey.toBase58(), ...serializeAccount(a.account) }));

    const offers = allOffers
      .filter((a: any) => a.account.provider.toBase58() === address)
      .map((a: any) => ({ publicKey: a.publicKey.toBase58(), ...serializeAccount(a.account) }));

    const deals = allDeals
      .filter((a: any) =>
        a.account.client.toBase58() === address ||
        a.account.provider.toBase58() === address
      )
      .map((a: any) => ({ publicKey: a.publicKey.toBase58(), ...serializeAccount(a.account) }));

    const completedDeals = deals.filter((d: any) => d.status === "completed");
    const totalDeals = deals.length;
    const reputation = totalDeals > 0 ? completedDeals.length / totalDeals : null;

    const totalEarned = completedDeals
      .filter((d: any) => d.provider === address)
      .reduce((sum: number, d: any) => sum + (typeof d.amountLamports === 'number' ? d.amountLamports : 0), 0);

    const totalSpent = completedDeals
      .filter((d: any) => d.client === address)
      .reduce((sum: number, d: any) => sum + (typeof d.amountLamports === 'number' ? d.amountLamports : 0), 0);

    res.json({
      success: true,
      data: {
        address,
        stats: {
          totalNeeds: needs.length,
          totalOffers: offers.length,
          totalDeals,
          completedDeals: completedDeals.length,
          reputation,
          totalEarnedLamports: totalEarned,
          totalEarnedSol: totalEarned / 1e9,
          totalSpentLamports: totalSpent,
          totalSpentSol: totalSpent / 1e9,
        },
        needs,
        offers,
        deals,
      },
    });
  } catch (error: any) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ success: false, error: "Failed to fetch profile" });
  }
});

// ---- IDL ----

app.get("/api/idl", (_req, res) => {
  res.json({ success: true, data: idl });
});

// ---- Error handling ----

app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`🚀 ClawSwap API running on port ${PORT}`);
  console.log(`📱 Health: http://localhost:${PORT}/health`);
  console.log(`🌐 RPC: ${RPC_URL}`);
  console.log(`📦 Program: ${PROGRAM_ID.toBase58()}`);
});

export default app;
