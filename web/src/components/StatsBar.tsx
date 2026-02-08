"use client";

import { useEffect, useState } from "react";
import { api, Stats } from "@/lib/api";

export default function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
    const interval = setInterval(() => {
      api.getStats().then(setStats).catch(console.error);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <StatCard label="Open Needs" value={stats.openNeeds} />
      <StatCard label="Total Deals" value={stats.totalDeals} />
      <StatCard label="Completed" value={stats.completedDeals} />
      <StatCard
        label="Volume"
        value={`${stats.totalVolumeSol.toFixed(2)} SOL`}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}
