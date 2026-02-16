"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import Link from "next/link";
import { api, Barter, shortenAddress, formatDate, statusColor } from "@/lib/api";
import { PROGRAM_ID, GLOBAL_ID } from "@/lib/constants";
import idl from "@/lib/idl/clawswap.json";

export default function BarterDetailPage() {
  const params = useParams();
  const barterId = parseInt(params.id as string);
  const { connection } = useConnection();
  const wallet = useWallet();

  const [barter, setBarter] = useState<Barter | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const [deliveryContent, setDeliveryContent] = useState("");
  const [deliveryHash, setDeliveryHash] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getBarter(barterId);
      setBarter(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [barterId]);

  useEffect(() => { refresh(); }, [refresh]);

  const getProgram = () => {
    if (!wallet.publicKey) throw new Error("Wallet not connected");
    const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
    return new Program(idl as any, provider);
  };

  const getBarterPda = (id: number) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("barter"), new BN(id).toArrayLike(Buffer, "le", 8)],
      PROGRAM_ID
    )[0];

  const getGlobalPda = () =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("global"), new BN(GLOBAL_ID).toArrayLike(Buffer, "le", 8)],
      PROGRAM_ID
    )[0];

  const handleAccept = async () => {
    if (!wallet.publicKey) return;
    setSubmitting(true); setActiveAction("accept");
    try {
      const program = getProgram();
      await program.methods.acceptBarter()
        .accounts({ barter: getBarterPda(barterId), caller: wallet.publicKey })
        .rpc();
      await refresh();
    } catch (e: any) { alert(`Error: ${e.message}`); }
    finally { setSubmitting(false); setActiveAction(null); }
  };

  const handleSubmitDelivery = async () => {
    if (!wallet.publicKey || !deliveryContent || !deliveryHash) return;
    setSubmitting(true); setActiveAction("deliver");
    try {
      const program = getProgram();
      await program.methods.submitBarterDelivery(deliveryContent, deliveryHash)
        .accounts({ barter: getBarterPda(barterId), caller: wallet.publicKey })
        .rpc();
      setDeliveryContent(""); setDeliveryHash("");
      await refresh();
    } catch (e: any) { alert(`Error: ${e.message}`); }
    finally { setSubmitting(false); setActiveAction(null); }
  };

  const handleConfirm = async () => {
    if (!wallet.publicKey) return;
    setSubmitting(true); setActiveAction("confirm");
    try {
      const program = getProgram();
      await program.methods.confirmBarterSide()
        .accounts({ barter: getBarterPda(barterId), caller: wallet.publicKey })
        .rpc();
      await refresh();
    } catch (e: any) { alert(`Error: ${e.message}`); }
    finally { setSubmitting(false); setActiveAction(null); }
  };

  const handleCancel = async () => {
    if (!wallet.publicKey) return;
    setSubmitting(true); setActiveAction("cancel");
    try {
      const program = getProgram();
      await program.methods.cancelBarter()
        .accounts({ barter: getBarterPda(barterId), initiator: wallet.publicKey })
        .rpc();
      await refresh();
    } catch (e: any) { alert(`Error: ${e.message}`); }
    finally { setSubmitting(false); setActiveAction(null); }
  };

  const handleDispute = async () => {
    if (!wallet.publicKey || !disputeReason) return;
    setSubmitting(true); setActiveAction("dispute");
    try {
      const program = getProgram();
      await program.methods.disputeBarter(disputeReason)
        .accounts({ barter: getBarterPda(barterId), caller: wallet.publicKey })
        .rpc();
      setDisputeReason(""); setShowDisputeForm(false);
      await refresh();
    } catch (e: any) { alert(`Error: ${e.message}`); }
    finally { setSubmitting(false); setActiveAction(null); }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#25D0AB]" />
      </div>
    );
  }

  if (!barter) {
    return (
      <div className="text-center py-20">
        <span className="text-4xl mb-4 block">❌</span>
        <p className="text-[#7E7E7E] mb-4">Barter not found</p>
        <Link href="/barters" className="text-[#25D0AB] hover:underline">← Back to Barters</Link>
      </div>
    );
  }

  const myPk = wallet.publicKey?.toBase58();
  const isInitiator = myPk === barter.initiator;
  const isCounterpart = myPk === barter.counterpart;
  const isParticipant = isInitiator || isCounterpart;
  const ZERO_PK = PublicKey.default.toBase58();

  // Progress steps
  const steps = [
    { label: "Created", done: true },
    { label: "Accepted", done: barter.status !== "open" && barter.status !== "cancelled" },
    { label: "A Delivered", done: !!barter.sideADelivery },
    { label: "B Delivered", done: !!barter.sideBDelivery },
    { label: "A Confirmed", done: barter.sideAConfirmed },
    { label: "B Confirmed", done: barter.sideBConfirmed },
    { label: "Complete", done: barter.status === "completed" },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/barters" className="text-sm text-[#505050] hover:text-[#7E7E7E] mb-4 inline-block">
        ← Back to Barters
      </Link>

      {/* Header */}
      <div className="bg-[#111111] rounded-2xl p-6 border border-white/[0.06] mb-6">
        <div className="flex justify-between items-start mb-4">
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${statusColor(barter.status)}`}>
            {barter.status}
          </span>
          <span className="text-[#505050] text-sm">Barter #{barter.id}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-[#0A0A0A] rounded-lg p-4">
            <p className="text-xs text-[#505050] mb-2">🎁 I Offer</p>
            <p className="text-white">{barter.whatIOffer}</p>
          </div>
          <div className="bg-[#0A0A0A] rounded-lg p-4">
            <p className="text-xs text-[#505050] mb-2">🎯 I Want</p>
            <p className="text-white">{barter.whatIWant}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-[#0A0A0A] rounded-lg p-3">
            <p className="text-xs text-[#505050] mb-1">Initiator</p>
            <Link href={`/profile/${barter.initiator}`} className="text-xs font-mono text-white hover:text-[#25D0AB]">
              {shortenAddress(barter.initiator, 6)}
            </Link>
            {isInitiator && <span className="text-xs text-[#25D0AB] ml-1">(you)</span>}
          </div>
          <div className="bg-[#0A0A0A] rounded-lg p-3">
            <p className="text-xs text-[#505050] mb-1">Counterpart</p>
            {barter.counterpart !== ZERO_PK ? (
              <>
                <Link href={`/profile/${barter.counterpart}`} className="text-xs font-mono text-white hover:text-[#25D0AB]">
                  {shortenAddress(barter.counterpart, 6)}
                </Link>
                {isCounterpart && <span className="text-xs text-[#25D0AB] ml-1">(you)</span>}
              </>
            ) : (
              <p className="text-xs text-[#7E7E7E]">Open to anyone</p>
            )}
          </div>
          <div className="bg-[#0A0A0A] rounded-lg p-3">
            <p className="text-xs text-[#505050] mb-1">Created</p>
            <p className="text-xs text-white">{formatDate(barter.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-[#111111] rounded-xl p-4 border border-white/[0.06] mb-6">
        <p className="text-sm text-[#7E7E7E] mb-3">Progress</p>
        <div className="flex items-center gap-1 overflow-x-auto">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center">
              <div className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                step.done ? "bg-[#25D0AB]/20 text-[#25D0AB]" : "bg-white/5 text-[#505050]"
              }`}>
                {step.done ? "✓" : "○"} {step.label}
              </div>
              {i < steps.length - 1 && <span className="text-[#505050] mx-1">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Accept button */}
      {barter.status === "open" && myPk && !isInitiator && (
        <div className="mb-6">
          <button
            onClick={handleAccept}
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-[#25D0AB] to-[#70E1C8] rounded-xl font-semibold hover:brightness-110 disabled:opacity-50 transition-all text-[#0A0A0A]"
          >
            {submitting && activeAction === "accept" ? "Accepting..." : "🤝 Accept Barter"}
          </button>
        </div>
      )}

      {/* Cancel button */}
      {barter.status === "open" && isInitiator && (
        <div className="mb-6">
          <button
            onClick={handleCancel}
            disabled={submitting}
            className="px-5 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm font-semibold hover:bg-red-500/30 disabled:opacity-50 transition-all"
          >
            {submitting && activeAction === "cancel" ? "Cancelling..." : "❌ Cancel Barter"}
          </button>
        </div>
      )}

      {/* Deliveries */}
      {barter.status === "inProgress" && isParticipant && (
        <div className="space-y-4 mb-6">
          {/* Side A delivery */}
          <div className="bg-[#111111] rounded-xl p-5 border border-white/[0.06]">
            <h3 className="text-sm font-semibold text-[#F7F7F7] mb-3">
              📦 Side A (Initiator) — {shortenAddress(barter.initiator)}
              {isInitiator && <span className="text-[#25D0AB] ml-1">(you)</span>}
            </h3>
            {barter.sideADelivery ? (
              <div className="bg-[#0A0A0A] rounded-lg p-3 space-y-2">
                <div>
                  <p className="text-xs text-[#505050]">Delivery</p>
                  <p className="text-sm text-white whitespace-pre-wrap">{barter.sideADelivery}</p>
                </div>
                {barter.sideAHash && (
                  <div>
                    <p className="text-xs text-[#505050]">Hash</p>
                    <p className="text-xs text-white font-mono break-all">{barter.sideAHash}</p>
                  </div>
                )}
                <p className="text-xs">{barter.sideAConfirmed ? <span className="text-[#25D0AB]">✓ Confirmed</span> : <span className="text-yellow-400">⏳ Pending confirmation</span>}</p>
                {isCounterpart && !barter.sideAConfirmed && (
                  <button
                    onClick={handleConfirm}
                    disabled={submitting}
                    className="px-5 py-2 bg-[#25D0AB] rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all text-[#0A0A0A]"
                  >
                    {submitting && activeAction === "confirm" ? "Confirming..." : "✅ Confirm Side A"}
                  </button>
                )}
              </div>
            ) : isInitiator ? (
              <div className="bg-[#25D0AB]/10 rounded-lg p-4 border border-[#25D0AB]/20 space-y-3">
                <textarea
                  value={deliveryContent}
                  onChange={(e) => setDeliveryContent(e.target.value)}
                  rows={3} maxLength={512}
                  placeholder="Paste your deliverable..."
                  className="w-full bg-[#0A0A0A] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm focus:border-[#25D0AB] focus:outline-none resize-none"
                />
                <p className="text-xs text-[#505050] text-right">{deliveryContent.length}/512</p>
                <div className="flex gap-2">
                  <input
                    value={deliveryHash}
                    onChange={(e) => setDeliveryHash(e.target.value)}
                    placeholder="Verification hash..."
                    className="flex-1 bg-[#0A0A0A] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm focus:border-[#25D0AB] focus:outline-none"
                  />
                  <button
                    onClick={handleSubmitDelivery}
                    disabled={submitting || !deliveryContent || !deliveryHash}
                    className="px-5 py-2 bg-[#25D0AB] rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all text-[#0A0A0A]"
                  >
                    {submitting && activeAction === "deliver" ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#505050]">⏳ Waiting for initiator to deliver...</p>
            )}
          </div>

          {/* Side B delivery */}
          <div className="bg-[#111111] rounded-xl p-5 border border-white/[0.06]">
            <h3 className="text-sm font-semibold text-[#F7F7F7] mb-3">
              📦 Side B (Counterpart) — {shortenAddress(barter.counterpart)}
              {isCounterpart && <span className="text-[#25D0AB] ml-1">(you)</span>}
            </h3>
            {barter.sideBDelivery ? (
              <div className="bg-[#0A0A0A] rounded-lg p-3 space-y-2">
                <div>
                  <p className="text-xs text-[#505050]">Delivery</p>
                  <p className="text-sm text-white whitespace-pre-wrap">{barter.sideBDelivery}</p>
                </div>
                {barter.sideBHash && (
                  <div>
                    <p className="text-xs text-[#505050]">Hash</p>
                    <p className="text-xs text-white font-mono break-all">{barter.sideBHash}</p>
                  </div>
                )}
                <p className="text-xs">{barter.sideBConfirmed ? <span className="text-[#25D0AB]">✓ Confirmed</span> : <span className="text-yellow-400">⏳ Pending confirmation</span>}</p>
                {isInitiator && !barter.sideBConfirmed && (
                  <button
                    onClick={handleConfirm}
                    disabled={submitting}
                    className="px-5 py-2 bg-[#25D0AB] rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all text-[#0A0A0A]"
                  >
                    {submitting && activeAction === "confirm" ? "Confirming..." : "✅ Confirm Side B"}
                  </button>
                )}
              </div>
            ) : isCounterpart ? (
              <div className="bg-[#25D0AB]/10 rounded-lg p-4 border border-[#25D0AB]/20 space-y-3">
                <textarea
                  value={deliveryContent}
                  onChange={(e) => setDeliveryContent(e.target.value)}
                  rows={3} maxLength={512}
                  placeholder="Paste your deliverable..."
                  className="w-full bg-[#0A0A0A] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm focus:border-[#25D0AB] focus:outline-none resize-none"
                />
                <p className="text-xs text-[#505050] text-right">{deliveryContent.length}/512</p>
                <div className="flex gap-2">
                  <input
                    value={deliveryHash}
                    onChange={(e) => setDeliveryHash(e.target.value)}
                    placeholder="Verification hash..."
                    className="flex-1 bg-[#0A0A0A] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm focus:border-[#25D0AB] focus:outline-none"
                  />
                  <button
                    onClick={handleSubmitDelivery}
                    disabled={submitting || !deliveryContent || !deliveryHash}
                    className="px-5 py-2 bg-[#25D0AB] rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all text-[#0A0A0A]"
                  >
                    {submitting && activeAction === "deliver" ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#505050]">⏳ Waiting for counterpart to deliver...</p>
            )}
          </div>

          {/* Dispute */}
          {!showDisputeForm ? (
            <button
              onClick={() => setShowDisputeForm(true)}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              ⚠️ Raise Dispute
            </button>
          ) : (
            <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
              <p className="text-sm text-[#7E7E7E] mb-3">⚠️ Raise a dispute:</p>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                maxLength={256} rows={3}
                placeholder="Describe the reason..."
                className="w-full bg-[#0A0A0A] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm focus:border-red-400 focus:outline-none resize-none mb-2"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDispute}
                  disabled={submitting || !disputeReason}
                  className="px-5 py-2 bg-red-500 rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all text-white"
                >
                  {submitting && activeAction === "dispute" ? "Submitting..." : "⚠️ Submit Dispute"}
                </button>
                <button
                  onClick={() => { setShowDisputeForm(false); setDisputeReason(""); }}
                  className="px-5 py-2 bg-white/5 border border-white/[0.06] rounded-lg text-sm hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completed */}
      {barter.status === "completed" && (
        <div className="bg-[#25D0AB]/10 rounded-lg p-6 border border-[#25D0AB]/20 text-center mb-6">
          <span className="text-3xl">🎉</span>
          <p className="text-[#25D0AB] mt-2">Barter completed! Both sides delivered and confirmed.</p>
        </div>
      )}

      {/* Disputed */}
      {barter.status === "disputed" && (
        <div className="bg-red-500/10 rounded-lg p-6 border border-red-500/20 mb-6">
          <p className="text-red-400 font-medium mb-2">⚠️ Barter Disputed</p>
          {barter.disputeReason && <p className="text-sm text-[#7E7E7E]">Reason: {barter.disputeReason}</p>}
        </div>
      )}

      {/* Cancelled */}
      {barter.status === "cancelled" && (
        <div className="bg-gray-500/10 rounded-lg p-6 border border-gray-500/20 text-center mb-6">
          <span className="text-3xl">❌</span>
          <p className="text-gray-400 mt-2">Barter cancelled.</p>
        </div>
      )}
    </div>
  );
}
