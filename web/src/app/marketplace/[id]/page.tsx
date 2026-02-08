"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import Link from "next/link";
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
import { PROGRAM_ID, GLOBAL_ID } from "@/lib/constants";
import idl from "@/lib/idl/clawswap.json";

export default function NeedDetailPage() {
  const params = useParams();
  const router = useRouter();
  const needId = parseInt(params.id as string);
  const { connection } = useConnection();
  const wallet = useWallet();

  const [need, setNeed] = useState<Need | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  // Forms
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerForm, setOfferForm] = useState({ price: "", message: "" });
  const [deliveryHash, setDeliveryHash] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [needData, offersData, dealsData] = await Promise.all([
        api.getNeed(needId),
        api.getOffers(needId),
        api.getDeals(),
      ]);
      setNeed(needData);
      setOffers(offersData);
      setDeals(dealsData.filter((d) => d.needId === needId));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [needId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getProgram = () => {
    if (!wallet.publicKey) throw new Error("Wallet not connected");
    const provider = new AnchorProvider(connection, wallet as any, {
      commitment: "confirmed",
    });
    return new Program(idl as any, provider);
  };

  const getGlobalPda = () =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("global"), new BN(GLOBAL_ID).toArrayLike(Buffer, "le", 8)],
      PROGRAM_ID
    )[0];

  const getNeedPda = (id: number) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("need"), new BN(id).toArrayLike(Buffer, "le", 8)],
      PROGRAM_ID
    )[0];

  const getOfferPda = (id: number) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("offer"), new BN(id).toArrayLike(Buffer, "le", 8)],
      PROGRAM_ID
    )[0];

  const getDealPda = (id: number) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("deal"), new BN(id).toArrayLike(Buffer, "le", 8)],
      PROGRAM_ID
    )[0];

  // ── Actions ──

  const handleMakeOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.publicKey) return;
    setSubmitting(true);
    setActiveAction("offer");
    try {
      const program = getProgram();
      const globalPda = getGlobalPda();
      const globalAccount = await (program.account as any).global.fetch(globalPda);
      const offerId = globalAccount.offerCounter.toNumber();

      await program.methods
        .createOffer(
          new BN(needId),
          new BN(Math.round(parseFloat(offerForm.price) * 1e9)),
          offerForm.message
        )
        .accounts({
          global: globalPda,
          need: getNeedPda(needId),
          offer: getOfferPda(offerId),
          provider: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setShowOfferForm(false);
      setOfferForm({ price: "", message: "" });
      await refresh();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  const handleAcceptOffer = async (offer: Offer) => {
    if (!wallet.publicKey) return;
    setSubmitting(true);
    setActiveAction(`accept-${offer.id}`);
    try {
      const program = getProgram();
      const globalPda = getGlobalPda();
      const globalAccount = await (program.account as any).global.fetch(globalPda);
      const dealId = globalAccount.dealCounter.toNumber();

      await program.methods
        .acceptOffer()
        .accounts({
          global: globalPda,
          need: getNeedPda(needId),
          offer: getOfferPda(offer.id),
          deal: getDealPda(dealId),
          client: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await refresh();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  const handleSubmitDelivery = async (deal: Deal) => {
    if (!wallet.publicKey || !deliveryHash) return;
    setSubmitting(true);
    setActiveAction(`deliver-${deal.id}`);
    try {
      const program = getProgram();

      await program.methods
        .submitDelivery(deliveryHash)
        .accounts({
          deal: getDealPda(deal.id),
          provider: wallet.publicKey,
        })
        .rpc();

      setDeliveryHash("");
      await refresh();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  const handleConfirmDelivery = async (deal: Deal) => {
    if (!wallet.publicKey) return;
    setSubmitting(true);
    setActiveAction(`confirm-${deal.id}`);
    try {
      const program = getProgram();

      await program.methods
        .confirmDelivery()
        .accounts({
          deal: getDealPda(deal.id),
          need: getNeedPda(deal.needId),
          client: wallet.publicKey,
          provider: new PublicKey(deal.provider),
        })
        .rpc();

      await refresh();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  // ── Render ──

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (!need) {
    return (
      <div className="text-center py-20">
        <span className="text-4xl mb-4 block">❌</span>
        <p className="text-gray-400 mb-4">Need not found</p>
        <Link href="/marketplace" className="text-purple-400 hover:underline">
          ← Back to Marketplace
        </Link>
      </div>
    );
  }

  const isCreator = wallet.publicKey?.toBase58() === need.creator;
  const myPk = wallet.publicKey?.toBase58();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <Link
        href="/marketplace"
        className="text-sm text-gray-500 hover:text-gray-300 mb-4 inline-block"
      >
        ← Back to Marketplace
      </Link>

      {/* Need Header */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <span
              className={`text-sm px-3 py-1 rounded-full font-medium ${statusColor(
                need.status
              )}`}
            >
              {need.status}
            </span>
            <span className="text-xs px-2 py-1 rounded bg-white/10 text-gray-300">
              {need.category}
            </span>
          </div>
          <span className="text-gray-500 text-sm">Need #{need.id}</span>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
          {need.title}
        </h1>
        <p className="text-gray-400 leading-relaxed mb-6">{need.description}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoBlock label="Budget" value={`${lamportsToSol(need.budgetLamports)} SOL`} highlight />
          <InfoBlock label="Creator" value={shortenAddress(need.creator, 6)} mono />
          <InfoBlock label="Posted" value={formatDate(need.createdAt)} />
          <InfoBlock
            label="Deadline"
            value={need.deadline ? formatDate(need.deadline) : "None"}
          />
        </div>
      </div>

      {/* Action Bar */}
      {need.status === "open" && !isCreator && wallet.publicKey && (
        <div className="mb-6">
          <button
            onClick={() => setShowOfferForm(!showOfferForm)}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold hover:from-purple-500 hover:to-pink-500 transition-all"
          >
            {showOfferForm ? "Cancel" : "🤝 Make an Offer"}
          </button>
        </div>
      )}

      {/* Offer Form */}
      {showOfferForm && (
        <form
          onSubmit={handleMakeOffer}
          className="bg-purple-500/10 rounded-2xl p-6 border border-purple-500/30 mb-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">
            Submit Your Offer
          </h3>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">
                Your Price (SOL)
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                value={offerForm.price}
                onChange={(e) =>
                  setOfferForm({ ...offerForm, price: e.target.value })
                }
                placeholder={`Budget: ${lamportsToSol(need.budgetLamports)} SOL`}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <p className="text-xs text-gray-500">
                Tip: Offering below budget ({lamportsToSol(need.budgetLamports)} SOL)
                increases your chances of being accepted.
              </p>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-sm text-gray-400 block mb-1">
              Why should they pick you?
            </label>
            <textarea
              required
              rows={3}
              value={offerForm.message}
              onChange={(e) =>
                setOfferForm({ ...offerForm, message: e.target.value })
              }
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-purple-500 focus:outline-none resize-none"
              placeholder="Describe your capabilities, experience, and estimated delivery time..."
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-2.5 bg-purple-600 rounded-lg font-semibold hover:bg-purple-500 disabled:opacity-50 transition-all"
          >
            {submitting && activeAction === "offer"
              ? "Submitting..."
              : "Submit Offer"}
          </button>
        </form>
      )}

      {/* Offers Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span>🤝</span> Offers
          <span className="text-sm font-normal text-gray-500">
            ({offers.length})
          </span>
        </h2>

        {offers.length === 0 ? (
          <div className="bg-white/5 rounded-xl p-8 border border-white/10 text-center">
            <span className="text-3xl mb-2 block">💬</span>
            <p className="text-gray-400">No offers yet.</p>
            {need.status === "open" && (
              <p className="text-gray-500 text-sm mt-1">
                Be the first to make an offer!
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="bg-white/5 rounded-xl p-5 border border-white/10 hover:bg-white/[0.07] transition-all"
              >
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${statusColor(
                          offer.status
                        )}`}
                      >
                        {offer.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        Offer #{offer.id}
                      </span>
                    </div>
                    <p className="text-white">{offer.message}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      by{" "}
                      <span className="font-mono">
                        {shortenAddress(offer.provider, 6)}
                      </span>{" "}
                      • {formatDate(offer.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-xl font-bold text-green-400">
                      {lamportsToSol(offer.priceLamports)} SOL
                    </p>
                    {need.status === "open" &&
                      offer.status === "pending" &&
                      isCreator && (
                        <button
                          onClick={() => handleAcceptOffer(offer)}
                          disabled={submitting}
                          className="px-5 py-2 bg-green-600 rounded-lg text-sm font-semibold hover:bg-green-500 disabled:opacity-50 transition-all"
                        >
                          {submitting && activeAction === `accept-${offer.id}`
                            ? "Accepting..."
                            : "✅ Accept & Escrow"}
                        </button>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deals Section */}
      {deals.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <span>📋</span> Active Deals
            <span className="text-sm font-normal text-gray-500">
              ({deals.length})
            </span>
          </h2>

          <div className="space-y-4">
            {deals.map((deal) => {
              const isProvider = myPk === deal.provider;
              const isClient = myPk === deal.client;

              return (
                <div
                  key={deal.id}
                  className="bg-white/5 rounded-xl p-5 border border-white/10"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm px-3 py-1 rounded-full font-medium ${statusColor(
                          deal.status
                        )}`}
                      >
                        {deal.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        Deal #{deal.id}
                      </span>
                    </div>
                    <p className="text-xl font-bold text-green-400">
                      {lamportsToSol(deal.amountLamports)} SOL
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-gray-500">Client:</span>{" "}
                      <span className="font-mono text-white text-xs">
                        {shortenAddress(deal.client, 6)}
                      </span>
                      {isClient && (
                        <span className="text-xs text-blue-400 ml-1">(you)</span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500">Provider:</span>{" "}
                      <span className="font-mono text-white text-xs">
                        {shortenAddress(deal.provider, 6)}
                      </span>
                      {isProvider && (
                        <span className="text-xs text-purple-400 ml-1">
                          (you)
                        </span>
                      )}
                    </div>
                  </div>

                  {deal.deliveryHash && (
                    <div className="bg-black/30 rounded-lg p-3 mb-4">
                      <p className="text-xs text-gray-500 mb-1">
                        📦 Delivery Hash
                      </p>
                      <p className="text-sm text-white font-mono break-all">
                        {deal.deliveryHash}
                      </p>
                    </div>
                  )}

                  {/* Provider: Submit Delivery */}
                  {deal.status === "inProgress" && isProvider && (
                    <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
                      <p className="text-sm text-gray-300 mb-3">
                        📦 Ready to deliver? Submit your work hash (IPFS, URL,
                        or identifier):
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={deliveryHash}
                          onChange={(e) => setDeliveryHash(e.target.value)}
                          placeholder="QmX7bF3jK9mN2pL4qR8s... or https://..."
                          className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                        />
                        <button
                          onClick={() => handleSubmitDelivery(deal)}
                          disabled={submitting || !deliveryHash}
                          className="px-5 py-2 bg-purple-600 rounded-lg text-sm font-semibold hover:bg-purple-500 disabled:opacity-50 transition-all"
                        >
                          {submitting &&
                          activeAction === `deliver-${deal.id}`
                            ? "Submitting..."
                            : "Submit"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Client: Confirm Delivery */}
                  {deal.status === "deliverySubmitted" && isClient && (
                    <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                      <p className="text-sm text-gray-300 mb-3">
                        ✅ Delivery received! Review the work and confirm to
                        release payment:
                      </p>
                      <button
                        onClick={() => handleConfirmDelivery(deal)}
                        disabled={submitting}
                        className="px-6 py-2.5 bg-green-600 rounded-lg font-semibold hover:bg-green-500 disabled:opacity-50 transition-all"
                      >
                        {submitting &&
                        activeAction === `confirm-${deal.id}`
                          ? "Confirming..."
                          : "✅ Confirm & Release Payment"}
                      </button>
                    </div>
                  )}

                  {/* Completed */}
                  {deal.status === "completed" && (
                    <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20 text-center">
                      <span className="text-2xl">🎉</span>
                      <p className="text-sm text-blue-300 mt-1">
                        Deal completed! {lamportsToSol(deal.amountLamports)} SOL
                        transferred to provider.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBlock({
  label,
  value,
  highlight,
  mono,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="bg-black/20 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p
        className={`text-sm font-semibold ${
          highlight ? "text-green-400" : "text-white"
        } ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
