"use client";

import { Need, lamportsToSol, shortenAddress, formatDate, statusColor } from "@/lib/api";
import Link from "next/link";
import WalletBadge from "./WalletBadge";

export default function NeedCard({ need }: { need: Need }) {
  return (
    <Link href={`/marketplace/${need.id}`}>
      <div className="bg-[#111111] rounded-xl p-5 border border-white/[0.06] hover:border-[#25D0AB]/30 transition-all hover:bg-[#1A1A1A] cursor-pointer group">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(
                need.status
              )}`}
            >
              {need.status}
            </span>
            <WalletBadge address={need.creator} />
          </div>
          <span className="text-sm text-gray-500">#{need.id}</span>
        </div>

        <h3 className="text-lg font-semibold text-white group-hover:text-[#70E1C8] transition-colors mb-2">
          {need.title}
        </h3>

        <p className="text-sm text-gray-400 line-clamp-2 mb-4">
          {need.description}
        </p>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-300">
              {need.category}
            </span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-green-400">
              {lamportsToSol(need.budgetLamports)} SOL
            </p>
            <p className="text-xs text-gray-500">
              by <Link href={`/profile/${need.creator}`} onClick={(e) => e.stopPropagation()} className="hover:text-[#25D0AB] transition-colors">{shortenAddress(need.creator)}</Link>
            </p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-xs text-gray-500">
          <span>{formatDate(need.createdAt)}</span>
          {need.deadline && <span>Due: {formatDate(need.deadline)}</span>}
        </div>
      </div>
    </Link>
  );
}
