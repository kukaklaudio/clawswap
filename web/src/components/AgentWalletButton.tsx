"use client";

import { useState, useEffect } from "react";
import {
  AgentWalletConfig,
  startConnect,
  completeConnect,
  saveConfig,
  loadConfig,
  clearConfig,
} from "@/lib/agentwallet";

export default function AgentWalletButton() {
  const [config, setConfig] = useState<AgentWalletConfig | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  const handleStartConnect = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await startConnect(email);
      setUsername(res.username);
      setStep("otp");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteConnect = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await completeConnect(username, email, otp);
      saveConfig(res);
      setConfig(res);
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    clearConfig();
    setConfig(null);
  };

  const resetForm = () => {
    setStep("email");
    setEmail("");
    setUsername("");
    setOtp("");
    setError("");
  };

  if (config) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg">
          <span className="text-sm">🤖</span>
          <span className="text-xs text-green-400 font-medium">
            {config.solanaAddress.slice(0, 4)}...{config.solanaAddress.slice(-4)}
          </span>
        </div>
        <button
          onClick={handleDisconnect}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          title="Disconnect AgentWallet"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
      >
        🤖 AgentWallet
      </button>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-white/10 overflow-hidden">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  🤖 Connect AgentWallet
                </h2>
                <button
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="text-gray-500 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-gray-400 mb-6">
                Connect your{" "}
                <a
                  href="https://agentwallet.mcpay.tech"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-400 hover:underline"
                >
                  AgentWallet
                </a>{" "}
                to trade on ClawSwap as an AI agent. Policy-controlled, auditable, secure.
              </p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {step === "email" ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="agent@example.com"
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-teal-500 focus:outline-none"
                      onKeyDown={(e) => e.key === "Enter" && email && handleStartConnect()}
                    />
                  </div>
                  <button
                    onClick={handleStartConnect}
                    disabled={!email || loading}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg font-semibold disabled:opacity-50 transition-all"
                  >
                    {loading ? "Sending OTP..." : "Send Verification Code"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-300">
                    Code sent to <strong>{email}</strong>
                  </p>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">6-digit code</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-[0.5em] placeholder-gray-500 focus:border-teal-500 focus:outline-none font-mono"
                      onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && handleCompleteConnect()}
                    />
                  </div>
                  <button
                    onClick={handleCompleteConnect}
                    disabled={otp.length !== 6 || loading}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg font-semibold disabled:opacity-50 transition-all"
                  >
                    {loading ? "Verifying..." : "Connect Wallet"}
                  </button>
                  <button
                    onClick={() => setStep("email")}
                    className="w-full text-sm text-gray-500 hover:text-gray-300"
                  >
                    ← Use different email
                  </button>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="text-xs text-gray-500 text-center">
                  Powered by{" "}
                  <a
                    href="https://agentwallet.mcpay.tech"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-400 hover:underline"
                  >
                    MCPay AgentWallet
                  </a>{" "}
                  — x402 ready, policy-controlled
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
