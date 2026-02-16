"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  api,
  Need,
  Offer,
  Deal,
  Barter,
  lamportsToSol,
  shortenAddress,
  formatDate,
  statusColor,
} from "@/lib/api";
import NeedCard from "@/components/NeedCard";

export default function ProfilePage() {
  const params = useParams();
  const address = params.address as string;

  const [needs, setNeeds] = useState<Need[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [barters, setBarters] = useState<Barter[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"needs" | "offers" | "deals" | "barters">("needs");

  const refresh = useCallback(async () => {
    try {
      const [n, o, d, b] = await Promise.all([
        api.getNeedsByCreator(address),
        api.getOffersByProvider(address),
        api.getDealsByUser(address),
        api.getBartersByUser(address),
      ]);
      setNeeds(n);
      setOffers(o);
      setDeals(d);
      setBarters(b);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const completedDeals = deals.filter((d) => d.status === "completed");
  const totalDeals = deals.length;
  const reputation = totalDeals > 0 ? ((completedDeals.length / totalDeals) * 100).toFixed(0) : "N/A";
  const totalEarned = completedDeals
    .filter((d) => d.provider === address)
    .reduce((sum, d) => sum + d.amountLamports, 0);
  const totalSpent = completedDeals
    .filter((d) => d.client === address)
    .reduce((sum, d) => sum + d.amountLamports, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/marketplace" className="text-sm text-[#505050] hover:text-[#7E7E7E] mb-4 inline-block">
        ← Back to Marketplace
      </Link>

      {/* Profile Header */}
      <div className="bg-[#111111] rounded-2xl p-6 border border-white/[0.06] mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#F7F7F7] mb-1">Profile</h1>
            <p className="text-[#7E7E7E] font-mono text-sm break-all">{address}</p>
          </div>
          <div className="flex gap-2">
            <div className="bg-[#0A0A0A] rounded-lg px-4 py-2 text-center">
              <p className="text-xs text-[#505050]">Reputation</p>
              <p className="text-xl font-bold text-[#25D0AB]">{reputation}{reputation !== "N/A" ? "%" : ""}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <StatBlock label="Needs" value={needs.length} />
          <StatBlock label="Offers" value={offers.length} />
          <StatBlock label="Total Deals" value={totalDeals} />
          <StatBlock label="Completed" value={completedDeals.length} />
          <StatBlock label="Earned" value={`${lamportsToSol(totalEarned)} SOL`} highlight />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 w-fit">
        {([
          { key: "needs" as const, label: `Needs (${needs.length})` },
          { key: "offers" as const, label: `Offers (${offers.length})` },
          { key: "deals" as const, label: `Deals (${deals.length})` },
          { key: "barters" as const, label: `Barters (${barters.length})` },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t.key ? "bg-[#25D0AB] text-[#0A0A0A]" : "text-[#7E7E7E] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#25D0AB]" />
        </div>
      ) : (
        <>
          {tab === "needs" && (
            needs.length === 0 ? (
              <EmptyState emoji="📝" text="No needs posted by this wallet" />
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {needs.map((need) => <NeedCard key={need.id} need={need} />)}
              </div>
            )
          )}

          {tab === "offers" && (
            offers.length === 0 ? (
              <EmptyState emoji="🤝" text="No offers made by this wallet" />
            ) : (
              <div className="space-y-3">
                {offers.map((offer) => (
                  <Link key={offer.id} href={`/marketplace/${offer.needId}`}>
                    <div className="bg-[#111111] rounded-xl p-4 border border-white/[0.06] hover:bg-[#1A1A1A] transition-all cursor-pointer">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(offer.status)}`}>
                              {offer.status}
                            </span>
                            <span className="text-xs text-[#505050]">Need #{offer.needId} • Offer #{offer.id}</span>
                          </div>
                          <p className="text-white text-sm">{offer.message}</p>
                          <p className="text-xs text-[#505050] mt-1">{formatDate(offer.createdAt)}</p>
                        </div>
                        <p className="text-lg font-bold text-[#25D0AB] ml-4">{lamportsToSol(offer.priceLamports)} SOL</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}

          {tab === "deals" && (
            deals.length === 0 ? (
              <EmptyState emoji="📋" text="No deals involving this wallet" />
            ) : (
              <div className="space-y-3">
                {deals.map((deal) => (
                  <Link key={deal.id} href={`/marketplace/${deal.needId}`}>
                    <div className="bg-[#111111] rounded-xl p-4 border border-white/[0.06] hover:bg-[#1A1A1A] transition-all cursor-pointer">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(deal.status)}`}>
                              {deal.status}
                            </span>
                            <span className="text-xs text-[#505050]">Deal #{deal.id} • Need #{deal.needId}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              deal.provider === address ? "bg-[#25D0AB]/20 text-[#25D0AB]" : "bg-blue-500/20 text-blue-400"
                            }`}>
                              {deal.provider === address ? "Provider" : "Client"}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-[#7E7E7E]">
                            <span>{shortenAddress(deal.client)} → {shortenAddress(deal.provider)}</span>
                          </div>
                        </div>
                        <p className="text-lg font-bold text-[#25D0AB] ml-4">{lamportsToSol(deal.amountLamports)} SOL</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}

          {tab === "barters" && (
            barters.length === 0 ? (
              <EmptyState emoji="🔄" text="No barters involving this wallet" />
            ) : (
              <div className="space-y-3">
                {barters.map((barter) => (
                  <Link key={barter.id} href={`/barters/${barter.id}`}>
                    <div className="bg-[#111111] rounded-xl p-4 border border-white/[0.06] hover:bg-[#1A1A1A] transition-all cursor-pointer">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(barter.status)}`}>
                              {barter.status}
                            </span>
                            <span className="text-xs text-[#505050]">Barter #{barter.id}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              barter.initiator === address ? "bg-[#25D0AB]/20 text-[#25D0AB]" : "bg-blue-500/20 text-blue-400"
                            }`}>
                              {barter.initiator === address ? "Initiator" : "Counterpart"}
                            </span>
                          </div>
                          <p className="text-sm text-white">🎁 {barter.whatIOffer} ↔ 🎯 {barter.whatIWant}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

function StatBlock({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-[#0A0A0A] rounded-lg p-3 text-center">
      <p className="text-xs text-[#505050]">{label}</p>
      <p className={`text-lg font-bold mt-1 ${highlight ? "text-[#25D0AB]" : "text-white"}`}>{value}</p>
    </div>
  );
}

function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="text-center py-12 bg-[#111111] rounded-2xl border border-white/[0.06]">
      <span className="text-4xl mb-3 block">{emoji}</span>
      <p className="text-[#7E7E7E]">{text}</p>
    </div>
  );
}
