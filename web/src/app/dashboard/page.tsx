"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
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
import Link from "next/link";

export default function DashboardPage() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [myNeeds, setMyNeeds] = useState<Need[]>([]);
  const [myOffers, setMyOffers] = useState<Offer[]>([]);
  const [myDeals, setMyDeals] = useState<Deal[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "needs" | "offers" | "deals">(
    "overview"
  );

  const refresh = useCallback(async () => {
    if (!wallet.publicKey) return;
    const pk = wallet.publicKey.toBase58();
    try {
      const [needs, offers, deals, bal] = await Promise.all([
        api.getNeedsByCreator(pk),
        api.getOffersByProvider(pk),
        api.getDealsByUser(pk),
        connection.getBalance(wallet.publicKey),
      ]);
      setMyNeeds(needs);
      setMyOffers(offers);
      setMyDeals(deals);
      setBalance(bal);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [wallet.publicKey, connection]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!wallet.publicKey) {
    return (
      <div className="text-center py-20 bg-[#111111] rounded-2xl border border-white/[0.06]">
        <span className="text-5xl mb-4 block">🔗</span>
        <p className="text-[#7E7E7E] text-lg mb-2">Connect your wallet</p>
        <p className="text-[#505050] text-sm">
          Connect a Solana wallet to see your dashboard
        </p>
      </div>
    );
  }

  const activeDeals = myDeals.filter(
    (d) => d.status === "inProgress" || d.status === "deliverySubmitted"
  );
  const completedDeals = myDeals.filter((d) => d.status === "completed");
  const totalEarned = completedDeals
    .filter((d) => d.provider === wallet.publicKey?.toBase58())
    .reduce((sum, d) => sum + d.amountLamports, 0);
  const totalSpent = completedDeals
    .filter((d) => d.client === wallet.publicKey?.toBase58())
    .reduce((sum, d) => sum + d.amountLamports, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#F7F7F7]">Dashboard</h1>
          <p className="text-[#7E7E7E] font-mono text-sm mt-1">
            {shortenAddress(wallet.publicKey.toBase58(), 8)}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/marketplace?action=create"
            className="px-5 py-2 bg-gradient-to-r from-[#25D0AB] to-[#70E1C8] rounded-lg font-semibold text-sm text-[#0A0A0A]"
          >
            + Post Need
          </Link>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-white/5 border border-white/[0.06] rounded-lg text-sm hover:bg-white/10 transition-all"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard
          label="Balance"
          value={`${(balance / LAMPORTS_PER_SOL).toFixed(2)} SOL`}
          color="text-white"
        />
        <StatCard label="My Needs" value={myNeeds.length} color="text-[#25D0AB]" />
        <StatCard label="My Offers" value={myOffers.length} color="text-[#D864D8]" />
        <StatCard
          label="Active Deals"
          value={activeDeals.length}
          color="text-[#F5A623]"
        />
        <StatCard
          label="Earned"
          value={`${lamportsToSol(totalEarned)} SOL`}
          color="text-[#25D0AB]"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 w-fit">
        {(
          [
            { key: "overview", label: "Overview" },
            { key: "needs", label: `Needs (${myNeeds.length})` },
            { key: "offers", label: `Offers (${myOffers.length})` },
            { key: "deals", label: `Deals (${myDeals.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-[#25D0AB] text-[#0A0A0A]"
                : "text-[#7E7E7E] hover:text-white"
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
          {/* Overview */}
          {tab === "overview" && (
            <div className="space-y-8">
              {activeDeals.length > 0 && (
                <Section title="⚡ Action Required" count={activeDeals.length}>
                  {activeDeals.map((deal) => (
                    <DealRow
                      key={deal.id}
                      deal={deal}
                      myPk={wallet.publicKey!.toBase58()}
                    />
                  ))}
                </Section>
              )}

              {myNeeds.length > 0 && (
                <Section title="📝 Your Recent Needs" count={myNeeds.length}>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myNeeds.slice(0, 6).map((need) => (
                      <NeedCard key={need.id} need={need} />
                    ))}
                  </div>
                </Section>
              )}

              {myOffers.length > 0 && (
                <Section title="🤝 Your Recent Offers" count={myOffers.length}>
                  {myOffers.slice(0, 5).map((offer) => (
                    <OfferRow key={offer.id} offer={offer} />
                  ))}
                </Section>
              )}

              {myNeeds.length === 0 &&
                myOffers.length === 0 &&
                myDeals.length === 0 && (
                  <div className="text-center py-16 bg-[#111111] rounded-2xl border border-white/[0.06]">
                    <span className="text-5xl mb-4 block">🚀</span>
                    <p className="text-[#7E7E7E] text-lg mb-2">
                      Welcome to ClawSwap!
                    </p>
                    <p className="text-[#505050] text-sm mb-6">
                      Start by posting a need or browsing the marketplace
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Link
                        href="/marketplace?action=create"
                        className="px-6 py-2.5 bg-gradient-to-r from-[#25D0AB] to-[#70E1C8] rounded-lg font-semibold text-sm text-[#0A0A0A]"
                      >
                        Post a Need
                      </Link>
                      <Link
                        href="/marketplace"
                        className="px-6 py-2.5 border border-white/[0.06] rounded-lg font-semibold text-sm hover:bg-white/5"
                      >
                        Browse Marketplace
                      </Link>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Needs Tab */}
          {tab === "needs" && (
            <div>
              {myNeeds.length === 0 ? (
                <EmptyState
                  emoji="📝"
                  text="No needs posted yet"
                  action="Post a Need"
                  href="/marketplace?action=create"
                />
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myNeeds.map((need) => (
                    <NeedCard key={need.id} need={need} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Offers Tab */}
          {tab === "offers" && (
            <div>
              {myOffers.length === 0 ? (
                <EmptyState
                  emoji="🤝"
                  text="No offers made yet"
                  action="Browse Marketplace"
                  href="/marketplace"
                />
              ) : (
                <div className="space-y-3">
                  {myOffers.map((offer) => (
                    <OfferRow key={offer.id} offer={offer} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Deals Tab */}
          {tab === "deals" && (
            <div>
              {myDeals.length === 0 ? (
                <EmptyState
                  emoji="📋"
                  text="No deals yet"
                  action="Browse Marketplace"
                  href="/marketplace"
                />
              ) : (
                <div className="space-y-3">
                  {myDeals.map((deal) => (
                    <DealRow
                      key={deal.id}
                      deal={deal}
                      myPk={wallet.publicKey!.toBase58()}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-[#111111] rounded-xl p-4 border border-white/[0.06]">
      <p className="text-xs text-[#505050] uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-[#F7F7F7] mb-3">{title}</h3>
      {children}
    </div>
  );
}

function OfferRow({ offer }: { offer: Offer }) {
  return (
    <Link href={`/marketplace/${offer.needId}`}>
      <div className="bg-[#111111] rounded-xl p-4 border border-white/[0.06] hover:bg-[#1A1A1A] transition-all cursor-pointer">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${statusColor(
                  offer.status
                )}`}
              >
                {offer.status}
              </span>
              <span className="text-xs text-[#505050]">
                Need #{offer.needId} • Offer #{offer.id}
              </span>
            </div>
            <p className="text-white text-sm">{offer.message}</p>
            <p className="text-xs text-[#505050] mt-1">
              {formatDate(offer.createdAt)}
            </p>
          </div>
          <p className="text-lg font-bold text-[#25D0AB] ml-4">
            {lamportsToSol(offer.priceLamports)} SOL
          </p>
        </div>
      </div>
    </Link>
  );
}

function DealRow({ deal, myPk }: { deal: Deal; myPk: string }) {
  const isProvider = myPk === deal.provider;
  const isClient = myPk === deal.client;
  const role = isProvider ? "Provider" : isClient ? "Client" : "Observer";

  let actionLabel = "";
  if (deal.status === "inProgress" && isProvider)
    actionLabel = "⚡ Submit delivery";
  if (deal.status === "deliverySubmitted" && isClient)
    actionLabel = "⚡ Confirm & pay";

  return (
    <Link href={`/marketplace/${deal.needId}`}>
      <div className="bg-[#111111] rounded-xl p-4 border border-white/[0.06] hover:bg-[#1A1A1A] transition-all cursor-pointer">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${statusColor(
                  deal.status
                )}`}
              >
                {deal.status}
              </span>
              <span className="text-xs text-[#505050]">
                Deal #{deal.id} • Need #{deal.needId}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  isProvider ? "bg-[#25D0AB]/20 text-[#25D0AB]" : "bg-blue-500/20 text-blue-400"
                }`}
              >
                {role}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-[#7E7E7E]">
              <span>
                {shortenAddress(deal.client)} → {shortenAddress(deal.provider)}
              </span>
            </div>
            {actionLabel && (
              <p className="text-xs text-[#F5A623] mt-1 font-medium">
                {actionLabel}
              </p>
            )}
          </div>
          <p className="text-lg font-bold text-[#25D0AB] ml-4">
            {lamportsToSol(deal.amountLamports)} SOL
          </p>
        </div>
      </div>
    </Link>
  );
}

function EmptyState({
  emoji,
  text,
  action,
  href,
}: {
  emoji: string;
  text: string;
  action: string;
  href: string;
}) {
  return (
    <div className="text-center py-12 bg-[#111111] rounded-2xl border border-white/[0.06]">
      <span className="text-4xl mb-3 block">{emoji}</span>
      <p className="text-[#7E7E7E] mb-4">{text}</p>
      <Link
        href={href}
        className="px-6 py-2.5 bg-gradient-to-r from-[#25D0AB] to-[#70E1C8] rounded-lg font-semibold text-sm inline-block text-[#0A0A0A]"
      >
        {action}
      </Link>
    </div>
  );
}
