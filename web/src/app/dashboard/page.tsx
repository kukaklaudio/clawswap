"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  api,
  Need,
  Offer,
  Deal,
  lamportsToSol,
  shortenAddress,
  formatDate,
  statusColor,
} from "@/lib/api";
import NeedCard from "@/components/NeedCard";

export default function DashboardPage() {
  const wallet = useWallet();
  const [myNeeds, setMyNeeds] = useState<Need[]>([]);
  const [myOffers, setMyOffers] = useState<Offer[]>([]);
  const [myDeals, setMyDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"needs" | "offers" | "deals">("needs");

  useEffect(() => {
    if (!wallet.publicKey) {
      setLoading(false);
      return;
    }

    const pk = wallet.publicKey.toBase58();
    Promise.all([
      api.getNeedsByCreator(pk),
      api.getOffersByProvider(pk),
      api.getDealsByUser(pk),
    ])
      .then(([needs, offers, deals]) => {
        setMyNeeds(needs);
        setMyOffers(offers);
        setMyDeals(deals);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [wallet.publicKey]);

  if (!wallet.publicKey) {
    return (
      <div className="text-center py-20">
        <span className="text-4xl mb-4 block">🔗</span>
        <p className="text-gray-400 text-lg">
          Connect your wallet to see your dashboard
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
      <p className="text-gray-400 mb-6 font-mono text-sm">
        {shortenAddress(wallet.publicKey.toBase58(), 8)}
      </p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/10 pb-2">
        {[
          { key: "needs" as const, label: "My Needs", count: myNeeds.length },
          {
            key: "offers" as const,
            label: "My Offers",
            count: myOffers.length,
          },
          { key: "deals" as const, label: "My Deals", count: myDeals.length },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-t text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t.label}{" "}
            <span className="text-xs opacity-60">({t.count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      ) : (
        <>
          {tab === "needs" && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myNeeds.length === 0 ? (
                <p className="text-gray-500 col-span-3 text-center py-10">
                  You haven&apos;t posted any needs yet.
                </p>
              ) : (
                myNeeds.map((need) => <NeedCard key={need.id} need={need} />)
              )}
            </div>
          )}

          {tab === "offers" && (
            <div className="space-y-3">
              {myOffers.length === 0 ? (
                <p className="text-gray-500 text-center py-10">
                  You haven&apos;t made any offers yet.
                </p>
              ) : (
                myOffers.map((offer) => (
                  <div
                    key={offer.id}
                    className="bg-white/5 rounded-xl p-4 border border-white/10"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${statusColor(
                            offer.status
                          )}`}
                        >
                          {offer.status}
                        </span>
                        <p className="text-white mt-2">
                          Need #{offer.needId}: {offer.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(offer.createdAt)}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-green-400">
                        {lamportsToSol(offer.priceLamports)} SOL
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "deals" && (
            <div className="space-y-3">
              {myDeals.length === 0 ? (
                <p className="text-gray-500 text-center py-10">
                  No deals yet.
                </p>
              ) : (
                myDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="bg-white/5 rounded-xl p-4 border border-white/10"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${statusColor(
                            deal.status
                          )}`}
                        >
                          {deal.status}
                        </span>
                        <p className="text-sm text-gray-400 mt-2">
                          Need #{deal.needId} • Client:{" "}
                          {shortenAddress(deal.client)} → Provider:{" "}
                          {shortenAddress(deal.provider)}
                        </p>
                        {deal.deliveryHash && (
                          <p className="text-xs text-gray-500 mt-1">
                            📦 {deal.deliveryHash}
                          </p>
                        )}
                      </div>
                      <p className="text-lg font-bold text-green-400">
                        {lamportsToSol(deal.amountLamports)} SOL
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
