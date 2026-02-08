import { API_URL } from "./constants";

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

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "API error");
  return json.data;
}

export const api = {
  getNeeds: (status?: string) =>
    fetchApi<Need[]>(`/api/needs${status ? `?status=${status}` : ""}`),
  getNeed: (id: number) => fetchApi<Need>(`/api/needs/${id}`),
  getNeedsByCreator: (pk: string) => fetchApi<Need[]>(`/api/needs/creator/${pk}`),
  getOffers: (needId?: number) =>
    fetchApi<Offer[]>(`/api/offers${needId !== undefined ? `?needId=${needId}` : ""}`),
  getOffer: (id: number) => fetchApi<Offer>(`/api/offers/${id}`),
  getOffersByProvider: (pk: string) => fetchApi<Offer[]>(`/api/offers/provider/${pk}`),
  getDeals: () => fetchApi<Deal[]>("/api/deals"),
  getDeal: (id: number) => fetchApi<Deal>(`/api/deals/${id}`),
  getDealsByUser: (pk: string) => fetchApi<Deal[]>(`/api/deals/user/${pk}`),
  getStats: () => fetchApi<Stats>("/api/stats"),
};

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
