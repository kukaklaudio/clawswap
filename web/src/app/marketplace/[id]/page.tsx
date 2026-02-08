"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
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
  const needId = parseInt(params.id as string);
  const { connection } = useConnection();
  const wallet = useWallet();

  const [need, setNeed] = useState<Need | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerForm, setOfferForm] = useState({ price: "0.05", message: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getNeed(needId),
      api.getOffers(needId),
      api.getDeals(),
    ])
      .then(([needData, offersData, dealsData]) => {
        setNeed(needData);
        setOffers(offersData);
        setDeals(dealsData.filter((d) => d.needId === needId));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [needId]);

  const handleMakeOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.publicKey) return;

    setSubmitting(true);
    try {
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = new Program(idl as any, provider);

      const globalPda = PublicKey.findProgramAddressSync(
        [Buffer.from("global"), new BN(GLOBAL_ID).toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
      )[0];

      const globalAccount = await (program.account as any).global.fetch(globalPda);
      const offerId = globalAccount.offerCounter.toNumber();
      const offerPda = PublicKey.findProgramAddressSync(
        [Buffer.from("offer"), new BN(offerId).toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
      )[0];

      const needPda = PublicKey.findProgramAddressSync(
        [Buffer.from("need"), new BN(needId).toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
      )[0];

      await program.methods
        .createOffer(
          new BN(needId),
          new BN(parseFloat(offerForm.price) * 1e9),
          offerForm.message
        )
        .accounts({
          global: globalPda,
          need: needPda,
          offer: offerPda,
          provider: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Refresh offers
      const newOffers = await api.getOffers(needId);
      setOffers(newOffers);
      setShowOfferForm(false);
      setOfferForm({ price: "0.05", message: "" });
    } catch (error: any) {
      console.error("Error creating offer:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptOffer = async (offer: Offer) => {
    if (!wallet.publicKey) return;

    setSubmitting(true);
    try {
      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = new Program(idl as any, provider);

      const globalPda = PublicKey.findProgramAddressSync(
        [Buffer.from("global"), new BN(GLOBAL_ID).toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
      )[0];

      const globalAccount = await (program.account as any).global.fetch(globalPda);
      const dealId = globalAccount.dealCounter.toNumber();

      const needPda = PublicKey.findProgramAddressSync(
        [Buffer.from("need"), new BN(needId).toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
      )[0];
      const offerPda = PublicKey.findProgramAddressSync(
        [Buffer.from("offer"), new BN(offer.id).toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
      )[0];
      const dealPda = PublicKey.findProgramAddressSync(
        [Buffer.from("deal"), new BN(dealId).toArrayLike(Buffer, "le", 8)],
        PROGRAM_ID
      )[0];

      await program.methods
        .acceptOffer()
        .accounts({
          global: globalPda,
          need: needPda,
          offer: offerPda,
          deal: dealPda,
          client: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Refresh
      const [newNeed, newOffers, newDeals] = await Promise.all([
        api.getNeed(needId),
        api.getOffers(needId),
        api.getDeals(),
      ]);
      setNeed(newNeed);
      setOffers(newOffers);
      setDeals(newDeals.filter((d) => d.needId === needId));
    } catch (error: any) {
      console.error("Error accepting offer:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

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
        <p className="text-gray-400">Need not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Need Header */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-6">
        <div className="flex justify-between items-start mb-4">
          <span
            className={`text-sm px-3 py-1 rounded-full font-medium ${statusColor(
              need.status
            )}`}
          >
            {need.status}
          </span>
          <span className="text-gray-500">#{need.id}</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">{need.title}</h1>
        <p className="text-gray-400 mb-4">{need.description}</p>

        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-gray-500">Category:</span>{" "}
            <span className="text-white">{need.category}</span>
          </div>
          <div>
            <span className="text-gray-500">Budget:</span>{" "}
            <span className="text-green-400 font-semibold">
              {lamportsToSol(need.budgetLamports)} SOL
            </span>
          </div>
          <div>
            <span className="text-gray-500">Creator:</span>{" "}
            <span className="text-white font-mono text-xs">
              {shortenAddress(need.creator, 6)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Posted:</span>{" "}
            <span className="text-white">{formatDate(need.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Offers */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">
            Offers ({offers.length})
          </h2>
          {need.status === "open" && (
            <button
              onClick={() => setShowOfferForm(!showOfferForm)}
              className="px-4 py-2 bg-purple-600 rounded-lg text-sm font-semibold hover:bg-purple-500 transition-all"
            >
              Make Offer
            </button>
          )}
        </div>

        {/* Offer Form */}
        {showOfferForm && (
          <form
            onSubmit={handleMakeOffer}
            className="bg-white/5 rounded-xl p-4 border border-purple-500/30 mb-4"
          >
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  Price (SOL)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.001"
                  required
                  value={offerForm.price}
                  onChange={(e) =>
                    setOfferForm({ ...offerForm, price: e.target.value })
                  }
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="text-sm text-gray-400 block mb-1">
                Message
              </label>
              <textarea
                required
                rows={2}
                value={offerForm.message}
                onChange={(e) =>
                  setOfferForm({ ...offerForm, message: e.target.value })
                }
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none resize-none"
                placeholder="Why should they pick you?"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !wallet.publicKey}
              className="px-6 py-2 bg-purple-600 rounded-lg text-sm font-semibold hover:bg-purple-500 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Offer"}
            </button>
          </form>
        )}

        {/* Offer List */}
        {offers.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No offers yet. Be the first!
          </p>
        ) : (
          <div className="space-y-3">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="bg-white/5 rounded-xl p-4 border border-white/10"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${statusColor(
                        offer.status
                      )}`}
                    >
                      {offer.status}
                    </span>
                    <p className="text-white mt-2">{offer.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      by {shortenAddress(offer.provider)} •{" "}
                      {formatDate(offer.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-400">
                      {lamportsToSol(offer.priceLamports)} SOL
                    </p>
                    {need.status === "open" &&
                      offer.status === "pending" &&
                      wallet.publicKey?.toBase58() === need.creator && (
                        <button
                          onClick={() => handleAcceptOffer(offer)}
                          disabled={submitting}
                          className="mt-2 px-4 py-1.5 bg-green-600 rounded-lg text-xs font-semibold hover:bg-green-500 disabled:opacity-50"
                        >
                          Accept
                        </button>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deals */}
      {deals.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">
            Deals ({deals.length})
          </h2>
          <div className="space-y-3">
            {deals.map((deal) => (
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
                      Client: {shortenAddress(deal.client)} → Provider:{" "}
                      {shortenAddress(deal.provider)}
                    </p>
                    {deal.deliveryHash && (
                      <p className="text-xs text-gray-500 mt-1">
                        Delivery: {deal.deliveryHash}
                      </p>
                    )}
                  </div>
                  <p className="text-lg font-bold text-green-400">
                    {lamportsToSol(deal.amountLamports)} SOL
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
