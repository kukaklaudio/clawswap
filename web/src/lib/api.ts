import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PROGRAM_ID, RPC_URL, GLOBAL_ID } from "./constants";
import IDL from "./idl/clawswap.json";

// ── Types ──

export interface Need {
  publicKey: string;
  id: number;
  creator: string;
  title: string;
  description: string;
  category: string;
  budgetLamports: number;
  status: string;
  createdAt: number;
  deadline: number | null;
}

export interface Offer {
  publicKey: string;
  id: number;
  needId: number;
  provider: string;
  priceLamports: number;
  message: string;
  status: string;
  createdAt: number;
}

export interface Deal {
  publicKey: string;
  id: number;
  needId: number;
  offerId: number;
  client: string;
  provider: string;
  amountLamports: number;
  status: string;
  createdAt: number;
  deliveryHash: string | null;
  deliveryContent: string | null;
}

export interface Stats {
  totalNeeds: number;
  openNeeds: number;
  totalOffers: number;
  totalDeals: number;
  completedDeals: number;
  totalVolumeLamports: number;
  totalVolumeSol: number;
}

// ── On-chain connection (read-only, no wallet needed) ──

const connection = new Connection(RPC_URL, "confirmed");

// Minimal read-only provider (no wallet signing needed for reads)
const readOnlyProvider = new AnchorProvider(
  connection,
  { publicKey: PublicKey.default, signTransaction: async (tx: any) => tx, signAllTransactions: async (txs: any) => txs } as any,
  { commitment: "confirmed" }
);

const program = new Program(IDL as any, readOnlyProvider);

// ── Helpers ──

function parseStatus(statusObj: Record<string, any>): string {
  return Object.keys(statusObj)[0];
}

function parseNeed(pubkey: PublicKey, account: any): Need {
  return {
    publicKey: pubkey.toBase58(),
    id: account.id.toNumber(),
    creator: account.creator.toBase58(),
    title: account.title,
    description: account.description,
    category: account.category,
    budgetLamports: account.budgetLamports.toNumber(),
    status: parseStatus(account.status),
    createdAt: account.createdAt.toNumber(),
    deadline: account.deadline ? account.deadline.toNumber() : null,
  };
}

function parseOffer(pubkey: PublicKey, account: any): Offer {
  return {
    publicKey: pubkey.toBase58(),
    id: account.id.toNumber(),
    needId: account.needId.toNumber(),
    provider: account.provider.toBase58(),
    priceLamports: account.priceLamports.toNumber(),
    message: account.message,
    status: parseStatus(account.status),
    createdAt: account.createdAt.toNumber(),
  };
}

function parseDeal(pubkey: PublicKey, account: any): Deal {
  return {
    publicKey: pubkey.toBase58(),
    id: account.id.toNumber(),
    needId: account.needId.toNumber(),
    offerId: account.offerId.toNumber(),
    client: account.client.toBase58(),
    provider: account.provider.toBase58(),
    amountLamports: account.amountLamports.toNumber(),
    status: parseStatus(account.status),
    createdAt: account.createdAt.toNumber(),
    deliveryHash: account.deliveryHash || null,
    deliveryContent: account.deliveryContent || null,
  };
}

// ── Cache (simple in-memory, 10s TTL) ──

const cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 10_000;

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  if (cache[key] && now - cache[key].ts < CACHE_TTL) {
    return cache[key].data as T;
  }
  const data = await fn();
  cache[key] = { data, ts: now };
  return data;
}

// ── API (reads directly from Solana) ──

export const api = {
  getNeeds: async (status?: string): Promise<Need[]> => {
    return cached(`needs-${status || "all"}`, async () => {
      const accounts = await (program.account as any).need.all();
      let needs = accounts.map((a: any) => parseNeed(a.publicKey, a.account));
      if (status && status !== "all") {
        needs = needs.filter((n: Need) => n.status === status);
      }
      // Sort by createdAt descending (newest first)
      needs.sort((a: Need, b: Need) => b.createdAt - a.createdAt);
      return needs;
    });
  },

  getNeed: async (id: number): Promise<Need> => {
    return cached(`need-${id}`, async () => {
      const [needPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("need"), new BN(id).toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
      );
      const account = await (program.account as any).need.fetch(needPda);
      return parseNeed(needPda, account);
    });
  },

  getNeedsByCreator: async (pk: string): Promise<Need[]> => {
    const allNeeds = await api.getNeeds();
    return allNeeds.filter((n) => n.creator === pk);
  },

  getOffers: async (needId?: number): Promise<Offer[]> => {
    return cached(`offers-${needId ?? "all"}`, async () => {
      const accounts = await (program.account as any).offer.all();
      let offers = accounts.map((a: any) => parseOffer(a.publicKey, a.account));
      if (needId !== undefined) {
        offers = offers.filter((o: Offer) => o.needId === needId);
      }
      offers.sort((a: Offer, b: Offer) => b.createdAt - a.createdAt);
      return offers;
    });
  },

  getOffer: async (id: number): Promise<Offer> => {
    return cached(`offer-${id}`, async () => {
      const [offerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("offer"), new BN(id).toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
      );
      const account = await (program.account as any).offer.fetch(offerPda);
      return parseOffer(offerPda, account);
    });
  },

  getOffersByProvider: async (pk: string): Promise<Offer[]> => {
    const allOffers = await api.getOffers();
    return allOffers.filter((o) => o.provider === pk);
  },

  getDeals: async (): Promise<Deal[]> => {
    return cached("deals-all", async () => {
      const accounts = await (program.account as any).deal.all();
      const deals = accounts.map((a: any) => parseDeal(a.publicKey, a.account));
      deals.sort((a: Deal, b: Deal) => b.createdAt - a.createdAt);
      return deals;
    });
  },

  getDeal: async (id: number): Promise<Deal> => {
    return cached(`deal-${id}`, async () => {
      const [dealPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("deal"), new BN(id).toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
      );
      const account = await (program.account as any).deal.fetch(dealPda);
      return parseDeal(dealPda, account);
    });
  },

  getDealsByUser: async (pk: string): Promise<Deal[]> => {
    const allDeals = await api.getDeals();
    return allDeals.filter((d) => d.client === pk || d.provider === pk);
  },

  getStats: async (): Promise<Stats> => {
    return cached("stats", async () => {
      const [needs, offers, deals] = await Promise.all([
        api.getNeeds(),
        api.getOffers(),
        api.getDeals(),
      ]);
      const completedDeals = deals.filter((d) => d.status === "completed");
      const totalVolumeLamports = completedDeals.reduce((sum, d) => sum + d.amountLamports, 0);
      return {
        totalNeeds: needs.length,
        openNeeds: needs.filter((n) => n.status === "open").length,
        totalOffers: offers.length,
        totalDeals: deals.length,
        completedDeals: completedDeals.length,
        totalVolumeLamports,
        totalVolumeSol: totalVolumeLamports / 1e9,
      };
    });
  },
};

// ── Utility functions ──

export function lamportsToSol(lamports: number): string {
  return (lamports / 1e9).toFixed(4);
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function statusColor(status: string): string {
  switch (status) {
    case "open": return "bg-green-500/20 text-green-400";
    case "inProgress": return "bg-yellow-500/20 text-yellow-400";
    case "completed": return "bg-blue-500/20 text-blue-400";
    case "pending": return "bg-gray-500/20 text-gray-400";
    case "accepted": return "bg-purple-500/20 text-purple-400";
    case "deliverySubmitted": return "bg-orange-500/20 text-orange-400";
    default: return "bg-gray-500/20 text-gray-400";
  }
}
