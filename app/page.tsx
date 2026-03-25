"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AuthBox from "./components/AuthBox";

const WINDOW_SIZE = 5;

const navItems = [
  { id: "dashboard", label: "Dashboard" },
  { id: "log", label: "Log Trade" },
  { id: "breakdown", label: "Breakdown" },
];

const tradeTypeOptions = ["Long", "Short", "Call", "Put"];
const emotionOptions = ["Confident", "FOMO", "Fear", "Greed", "Revenge"];
const yesNoOptions = ["Yes", "No"];
const timeframeOptions = ["1m", "5m", "15m", "1h", "4h", "1d"];

type Trade = {
  id: number;
  user_id?: string;
  ticker: string;
  type: string;
  buy: number;
  sell: number;
  timeframe: string;
  emotion: string;
  followedPlan: string;
  wouldRepeat: string;
  reason: string;
  pnl: number;
  score: number;
  luckLabel: string;
  insight: string;
};

type TradeForm = {
  ticker: string;
  type: string;
  buy: string;
  sell: string;
  timeframe: string;
  emotion: string;
  followedPlan: string;
  wouldRepeat: string;
  reason: string;
};

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "cyan" | "emerald" | "amber" | "rose";
}) {
  const styles = {
    default: "border-white/10 bg-white/5 text-slate-200",
    cyan: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
    emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    rose: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
        styles[tone] || styles.default
      }`}
    >
      {children}
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-white/5 shadow-xl shadow-black/20 ${className}`}
    >
      {children}
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function StatCard({
  label,
  value,
  footnote,
}: {
  label: string;
  value: string;
  footnote?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      {footnote ? <p className="mt-2 text-sm text-slate-500">{footnote}</p> : null}
    </Card>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/70 p-8 text-center">
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function normalizeEmotion(emotion: string) {
  const value = String(emotion || "").trim().toLowerCase();
  if (value === "fomo") return "FOMO";
  if (value === "fear") return "Fear";
  if (value === "greed") return "Greed";
  if (value === "revenge") return "Revenge";
  if (value === "confident") return "Confident";
  return "";
}

function normalizeYesNo(value: string) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "yes" || normalized === "y") return "Yes";
  if (normalized === "no" || normalized === "n") return "No";
  return "";
}

function calculatePnl(type: string, buy: number, sell: number) {
  if (type === "Short") return buy - sell;
  return sell - buy;
}

function baseScore({
  followedPlan,
  emotion,
  hasReason,
  wouldRepeat,
  timeframe,
}: {
  followedPlan: string;
  emotion: string;
  hasReason: boolean;
  wouldRepeat: string;
  timeframe: string;
}) {
  let score = 0;

  if (followedPlan === "Yes") score += 3;
  if (hasReason) score += 2;
  if (wouldRepeat === "Yes" && followedPlan === "Yes") score += 1;

  let psych = 3;
  if (emotion === "FOMO") psych -= 1;
  if (emotion === "Fear") psych -= 1;
  if (emotion === "Greed") psych -= 1;
  if (emotion === "Revenge") psych -= 2;
  psych = Math.max(0, psych);
  score += psych;

  if (timeframe) score += 1;

  return Math.max(0, Math.min(10, score));
}

function patternPenalty(trades: Trade[], current: Partial<Trade>) {
  const recent = trades.slice(0, WINDOW_SIZE);
  let penalty = 0;

  const sameEmotionCount = recent.filter(
    (trade) => trade.emotion && trade.emotion === current.emotion
  ).length;
  if (current.emotion && sameEmotionCount >= 2) penalty += 1;
  if (current.emotion && sameEmotionCount >= 3) penalty += 2;

  const noPlanCount = recent.filter((trade) => trade.followedPlan === "No").length;
  if (current.followedPlan === "No" && noPlanCount >= 2) penalty += 1;
  if (current.followedPlan === "No" && noPlanCount >= 3) penalty += 2;

  const sameTickerCount = recent.filter((trade) => trade.ticker === current.ticker).length;
  if (current.ticker && sameTickerCount >= 2) penalty += 1;

  return Math.min(3, penalty);
}

function luckLabel(score: number, pnl: number) {
  if (score >= 7 && pnl > 0) return "Skill > Luck";
  if (score >= 7 && pnl <= 0) return "Good process";
  if (score < 5 && pnl > 0) return "Luck > Skill";
  if (score < 5 && pnl <= 0) return "Poor trade";
  return "Balanced";
}

function makeInsight(trade: Trade) {
  if (trade.score >= 7 && trade.pnl <= 0) {
    return "Good process. This loss looks more like variance than a bad decision.";
  }
  if (trade.score < 5 && trade.pnl > 0) {
    return "Profitable, but the process may not be repeatable.";
  }
  if (trade.followedPlan === "No") {
    return "You broke plan. Focus on discipline first.";
  }
  if (trade.emotion === "FOMO") {
    return "This entry may have been rushed. Wait for stronger confirmation.";
  }
  if (trade.emotion === "Fear") {
    return "Fear may have affected execution. Review your exit rules.";
  }
  if (trade.emotion === "Revenge") {
    return "This looks reactive. Slow down before the next entry.";
  }
  return "Solid structure overall. Keep refining the setup.";
}

const initialForm: TradeForm = {
  ticker: "",
  type: "Long",
  buy: "",
  sell: "",
  timeframe: "5m",
  emotion: "Confident",
  followedPlan: "Yes",
  wouldRepeat: "Yes",
  reason: "",
};

function DashboardPage({
  trades,
  selectTrade,
  goTo,
  onEdit,
  onDelete,
  isLoading,
}: {
  trades: Trade[];
  selectTrade: (trade: Trade) => void;
  goTo: (page: string) => void;
  onEdit: (trade: Trade) => void;
  onDelete: (tradeId: number) => void;
  isLoading: boolean;
}) {
  const avgScore = useMemo(() => {
    if (!trades.length) return "0.0";
    return (trades.reduce((sum, trade) => sum + trade.score, 0) / trades.length).toFixed(1);
  }, [trades]);

  const netPnl = useMemo(() => trades.reduce((sum, trade) => sum + trade.pnl, 0), [trades]);

  const winRate = useMemo(() => {
    if (!trades.length) return 0;
    return Math.round((trades.filter((trade) => trade.pnl > 0).length / trades.length) * 100);
  }, [trades]);

  const tickerStats = useMemo(() => {
    const map: Record<
      string,
      {
        trades: number;
        wins: number;
        pnl: number;
        totalScore: number;
        emotions: Record<string, number>;
      }
    > = {};

    trades.forEach((trade) => {
      if (!map[trade.ticker]) {
        map[trade.ticker] = {
          trades: 0,
          wins: 0,
          pnl: 0,
          totalScore: 0,
          emotions: {},
        };
      }

      const t = map[trade.ticker];
      t.trades += 1;
      t.pnl += trade.pnl;
      t.totalScore += trade.score;

      if (trade.pnl > 0) t.wins += 1;

      if (trade.emotion) {
        t.emotions[trade.emotion] = (t.emotions[trade.emotion] || 0) + 1;
      }
    });

    return Object.entries(map)
      .map(([ticker, data]) => {
        const topEmotionEntry = Object.entries(data.emotions).sort((a, b) => b[1] - a[1])[0];

        return {
          ticker,
          trades: data.trades,
          winRate: Math.round((data.wins / data.trades) * 100),
          pnl: data.pnl,
          avgScore: Number((data.totalScore / data.trades).toFixed(1)),
          topEmotion: topEmotionEntry ? topEmotionEntry[0] : "None",
        };
      })
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  const patternSummary = useMemo(() => {
    const emotions: Record<string, number> = {};
    trades.slice(0, WINDOW_SIZE).forEach((trade) => {
      if (!trade.emotion) return;
      emotions[trade.emotion] = (emotions[trade.emotion] || 0) + 1;
    });
    const top = Object.entries(emotions).sort((a, b) => b[1] - a[1])[0];
    if (!top) return "No recurring patterns yet.";
    return `${top[0]} has shown up ${top[1]} time${top[1] > 1 ? "s" : ""} in your recent trades.`;
  }, [trades]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
      <SectionHeading
        title="Dashboard"
        subtitle="Decision quality over outcome"
        action={
          <button
            onClick={() => goTo("log")}
            className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950"
          >
            New Trade
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Avg Score" value={`${avgScore}/10`} footnote="Quality of decisions" />
        <StatCard label="Win Rate" value={`${winRate}%`} footnote="Based on logged trades" />
        <StatCard
          label="Net P/L"
          value={`${netPnl > 0 ? "+" : ""}$${netPnl.toFixed(2)}`}
          footnote="Outcome only"
        />
        <StatCard
          label="Pattern"
          value={trades.length ? trades[0].luckLabel : "None yet"}
          footnote="Latest read"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6">
          <SectionHeading title="Recent trades" subtitle="Click any trade to inspect it" />
          <div className="space-y-3">
            {isLoading ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 text-slate-300">
                Loading trades...
              </div>
            ) : trades.length === 0 ? (
              <EmptyState
                title="No trades yet"
                description="Log your first trade to start building your journal and tracking your decision quality."
                action={
                  <button
                    onClick={() => goTo("log")}
                    className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950"
                  >
                    Log First Trade
                  </button>
                }
              />
            ) : (
              trades.map((trade) => (
                <div
                  key={trade.id}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 p-4 transition hover:border-cyan-400/30"
                >
                  <button
                    onClick={() => {
                      selectTrade(trade);
                      goTo("breakdown");
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">
                          {trade.ticker} · {trade.type}
                        </p>
                        <p className="mt-1 text-sm text-slate-400">{trade.reason}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={trade.score >= 7 ? "emerald" : trade.score >= 5 ? "amber" : "rose"}>
                          {trade.score}/10
                        </Badge>
                        <Badge tone="cyan">{trade.luckLabel}</Badge>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-4 text-sm">
                      <span className="text-slate-400">
                        P/L {trade.pnl > 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                      </span>
                      <span className="text-slate-300">{trade.insight}</span>
                    </div>
                  </button>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={() => onEdit(trade)}
                      className="rounded-2xl border border-cyan-400/20 px-4 py-2 text-sm text-cyan-200 transition hover:bg-cyan-400/10"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(trade.id)}
                      className="rounded-2xl border border-rose-400/20 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-400/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <SectionHeading title="Behavior" subtitle="What the system notices" />
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
                {trades.length === 0
                  ? "Behavior patterns will start showing up after you log a few trades."
                  : patternSummary}
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
                Strong losses should not always reduce confidence if the process was sound.
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
                Repeated emotional entries should lower score even when a trade works.
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <SectionHeading title="Coach note" subtitle="Built in feedback" />
            <p className="text-sm leading-6 text-slate-300">
              This version uses local feedback only. We can connect AI later.
            </p>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <Card className="p-6">
          <SectionHeading title="Ticker performance" subtitle="Stats for each ticker" />
          <div className="space-y-3">
            {isLoading ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 text-slate-300">
                Loading ticker stats...
              </div>
            ) : tickerStats.length === 0 ? (
              <EmptyState
                title="No ticker stats yet"
                description="Once you log trades, this area will show win rate, score, P/L, and your most common emotion for each ticker."
              />
            ) : (
              tickerStats.map((t) => (
                <div key={t.ticker} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-semibold text-white">{t.ticker}</p>
                    <Badge tone={t.avgScore >= 7 ? "emerald" : t.avgScore >= 5 ? "amber" : "rose"}>
                      {t.avgScore}/10
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
                    <span>{t.trades} trades</span>
                    <span>{t.winRate}% win rate</span>
                    <span>{t.pnl > 0 ? "+" : ""}${t.pnl.toFixed(2)}</span>
                    <span>Emotion: {t.topEmotion}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function LogTradePage({
  form,
  setForm,
  onSave,
  goTo,
  coachPreview,
  isEditing,
  onCancelEdit,
}: {
  form: TradeForm;
  setForm: React.Dispatch<React.SetStateAction<TradeForm>>;
  onSave: () => void;
  goTo: (page: string) => void;
  coachPreview: string;
  isEditing: boolean;
  onCancelEdit: () => void;
}) {
  const inputClass =
    "w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40";
  const selectClass =
    "w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400/40";

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 lg:px-10">
      <SectionHeading
        title={isEditing ? "Edit trade" : "Log trade"}
        subtitle={isEditing ? "Update an existing trade" : "Minimal input first, then reflection"}
        action={
          <button
            onClick={() => goTo("dashboard")}
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300"
          >
            Back
          </button>
        }
      />

      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-2 block text-sm text-slate-400">Ticker</span>
            <input
              className={inputClass}
              value={form.ticker}
              onChange={(e) => setForm((prev) => ({ ...prev, ticker: e.target.value }))}
              placeholder="AAPL"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm text-slate-400">Trade Type</span>
            <select
              className={selectClass}
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
            >
              {tradeTypeOptions.map((option) => (
                <option key={option} value={option} className="bg-slate-950 text-white">
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-sm text-slate-400">Buy</span>
            <input
              className={inputClass}
              value={form.buy}
              onChange={(e) => setForm((prev) => ({ ...prev, buy: e.target.value }))}
              placeholder="120.50"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm text-slate-400">Sell</span>
            <input
              className={inputClass}
              value={form.sell}
              onChange={(e) => setForm((prev) => ({ ...prev, sell: e.target.value }))}
              placeholder="124.90"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm text-slate-400">Timeframe</span>
            <select
              className={selectClass}
              value={form.timeframe}
              onChange={(e) => setForm((prev) => ({ ...prev, timeframe: e.target.value }))}
            >
              {timeframeOptions.map((option) => (
                <option key={option} value={option} className="bg-slate-950 text-white">
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-sm text-slate-400">Emotion</span>
            <select
              className={selectClass}
              value={form.emotion}
              onChange={(e) => setForm((prev) => ({ ...prev, emotion: e.target.value }))}
            >
              {emotionOptions.map((option) => (
                <option key={option} value={option} className="bg-slate-950 text-white">
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-sm text-slate-400">Followed Plan</span>
            <select
              className={selectClass}
              value={form.followedPlan}
              onChange={(e) => setForm((prev) => ({ ...prev, followedPlan: e.target.value }))}
            >
              {yesNoOptions.map((option) => (
                <option key={option} value={option} className="bg-slate-950 text-white">
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-sm text-slate-400">Would Take Again</span>
            <select
              className={selectClass}
              value={form.wouldRepeat}
              onChange={(e) => setForm((prev) => ({ ...prev, wouldRepeat: e.target.value }))}
            >
              {yesNoOptions.map((option) => (
                <option key={option} value={option} className="bg-slate-950 text-white">
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-2">
            <span className="mb-2 block text-sm text-slate-400">Reason</span>
            <textarea
              className={inputClass}
              rows={4}
              value={form.reason}
              onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Why did you take this trade?"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onSave}
              className="rounded-2xl bg-cyan-400 px-5 py-3 font-medium text-slate-950"
            >
              {isEditing ? "Update Trade" : "Save Trade"}
            </button>

            {isEditing ? (
              <button
                onClick={onCancelEdit}
                className="rounded-2xl border border-white/10 px-5 py-3 font-medium text-slate-300"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-sm font-medium text-white">Coach preview</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{coachPreview}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function BreakdownPage({
  trade,
  goTo,
  onEdit,
  onDelete,
  isLoading,
}: {
  trade: Trade | null;
  goTo: (page: string) => void;
  onEdit: (trade: Trade) => void;
  onDelete: (tradeId: number) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8 lg:px-10">
        <Card className="p-6">
          <p className="text-slate-300">Loading trade...</p>
        </Card>
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8 lg:px-10">
        <EmptyState
          title="No trade selected"
          description="Choose a trade from the dashboard, or log your first trade to see a full breakdown here."
          action={
            <button
              onClick={() => goTo("log")}
              className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950"
            >
              Log First Trade
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10">
      <SectionHeading
        title={`${trade.ticker} breakdown`}
        subtitle="Outcome vs process"
        action={
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onEdit(trade)}
              className="rounded-2xl border border-cyan-400/20 px-4 py-2 text-sm text-cyan-200"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(trade.id)}
              className="rounded-2xl border border-rose-400/20 px-4 py-2 text-sm text-rose-200"
            >
              Delete
            </button>
            <button
              onClick={() => goTo("dashboard")}
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300"
            >
              Back
            </button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-6">
          <div className="flex flex-wrap gap-2">
            <Badge tone={trade.score >= 7 ? "emerald" : trade.score >= 5 ? "amber" : "rose"}>
              Score {trade.score}/10
            </Badge>
            <Badge tone="cyan">{trade.luckLabel}</Badge>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-slate-400">Type</p>
              <p className="mt-1 text-white">{trade.type}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-slate-400">P/L</p>
              <p className="mt-1 text-white">
                {trade.pnl > 0 ? "+" : ""}${trade.pnl.toFixed(2)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-slate-400">Entry</p>
              <p className="mt-1 text-white">{trade.buy}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-slate-400">Exit</p>
              <p className="mt-1 text-white">{trade.sell}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-slate-400">Emotion</p>
              <p className="mt-1 text-white">{trade.emotion || "None"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-slate-400">Followed Plan</p>
              <p className="mt-1 text-white">{trade.followedPlan || "Unknown"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-slate-400">Timeframe</p>
              <p className="mt-1 text-white">{trade.timeframe || "Unknown"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-slate-400">Would Repeat</p>
              <p className="mt-1 text-white">{trade.wouldRepeat || "Unknown"}</p>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <SectionHeading title="Built in feedback" subtitle="Local analysis" />
            <p className="text-sm leading-6 text-slate-300">{trade.insight}</p>
          </Card>

          <Card className="p-6">
            <SectionHeading title="Reason" subtitle="Original trade note" />
            <p className="text-sm leading-6 text-slate-300">
              {trade.reason || "No reason recorded."}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [activePage, setActivePage] = useState("dashboard");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [editingTradeId, setEditingTradeId] = useState<number | null>(null);
  const [form, setForm] = useState<TradeForm>(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function getCurrentUser() {
      const { data, error } = await supabase.auth.getUser();

      console.log("USER DATA:", data);
      console.log("USER ERROR:", error);

      setUser(data.user ?? null);
    }

    getCurrentUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function loadTrades() {
      if (!user) {
        setTrades([]);
        setSelectedTrade(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const { data, error } = await supabase
        .from("trades")
       .select("*")
       .eq("user_id", user.id)
       .order("created_at", { ascending: false });

      console.log("LOAD DATA:", data);
      console.log("LOAD ERROR:", error);

      if (error || !data) {
        setTrades([]);
        setSelectedTrade(null);
        setIsLoading(false);
        return;
      }

      const formattedTrades: Trade[] = data.map((item: any) => ({
        id: item.id,
        ticker: item.ticker,
        type: item.type,
        buy: Number(item.buy),
        sell: Number(item.sell),
        timeframe: item.timeframe,
        emotion: item.emotion,
        followedPlan: item.followed_plan,
        wouldRepeat: item.would_repeat,
        reason: item.reason,
        pnl: Number(item.pnl),
        score: Number(item.score),
        luckLabel: item.luck_label,
        insight: item.insight,
      }));

      setTrades(formattedTrades);
      setSelectedTrade(formattedTrades.length ? formattedTrades[0] : null);
      setIsLoading(false);
    }

    loadTrades();
  }, [user]);

  useEffect(() => {
    if (!selectedTrade && trades.length) {
      setSelectedTrade(trades[0]);
      return;
    }

    if (selectedTrade) {
      const updated = trades.find((trade) => trade.id === selectedTrade.id);
      if (!updated && trades.length) {
        setSelectedTrade(trades[0]);
      } else if (!updated) {
        setSelectedTrade(null);
      } else if (updated !== selectedTrade) {
        setSelectedTrade(updated);
      }
    }
  }, [trades, selectedTrade]);

  const coachPreview = useMemo(() => {
    const buy = Number(form.buy);
    const sell = Number(form.sell);

    if (!form.ticker.trim() || Number.isNaN(buy) || Number.isNaN(sell)) {
      return "Add a ticker plus valid entry and exit prices to preview your coaching feedback.";
    }

    const previewTrade = {
      ticker: form.ticker.trim().toUpperCase(),
      type: form.type,
      buy,
      sell,
      timeframe: form.timeframe,
      emotion: normalizeEmotion(form.emotion),
      followedPlan: normalizeYesNo(form.followedPlan),
      wouldRepeat: normalizeYesNo(form.wouldRepeat),
      reason: form.reason.trim(),
    };

    const pnl = calculatePnl(previewTrade.type, buy, sell);
    const score = Math.max(
      0,
      Math.min(
        10,
        baseScore({
          followedPlan: previewTrade.followedPlan,
          emotion: previewTrade.emotion,
          hasReason: !!previewTrade.reason,
          wouldRepeat: previewTrade.wouldRepeat,
          timeframe: previewTrade.timeframe,
        }) - patternPenalty(trades, previewTrade as Partial<Trade>)
      )
    );

    if (previewTrade.followedPlan === "No") {
      return "You marked that the plan was not followed, so discipline is the main issue to fix first.";
    }
    if (previewTrade.emotion === "FOMO") {
      return "This may be a rushed entry. Wait for confirmation instead of chasing price.";
    }
    if (previewTrade.emotion === "Revenge") {
      return "This may be reactive. Slow down before the next trade.";
    }
    if (score >= 7) {
      return "This looks structurally solid. The setup seems more disciplined and repeatable.";
    }
    if (pnl > 0) {
      return "This may work out, but the process still needs to be clean and repeatable.";
    }
    return "This trade likely needs more structure before it becomes repeatable.";
  }, [form, trades]);

  function handleEdit(trade: Trade) {
    setEditingTradeId(trade.id);
    setForm({
      ticker: trade.ticker,
      type: trade.type,
      buy: String(trade.buy),
      sell: String(trade.sell),
      timeframe: trade.timeframe,
      emotion: trade.emotion,
      followedPlan: trade.followedPlan,
      wouldRepeat: trade.wouldRepeat,
      reason: trade.reason,
    });
    setSelectedTrade(trade);
    setActivePage("log");
  }

  function handleCancelEdit() {
    setEditingTradeId(null);
    setForm(initialForm);
  }

  async function handleSave() {
    const buy = Number(form.buy);
    const sell = Number(form.sell);

    if (!form.ticker.trim()) {
      alert("Please enter a ticker.");
      return;
    }

    if (Number.isNaN(buy) || Number.isNaN(sell)) {
      alert("Buy and Sell must be valid numbers.");
      return;
    }

    const normalizedTrade = {
      ticker: form.ticker.trim().toUpperCase(),
      type: form.type,
      buy,
      sell,
      timeframe: form.timeframe,
      emotion: normalizeEmotion(form.emotion),
      followedPlan: normalizeYesNo(form.followedPlan),
      wouldRepeat: normalizeYesNo(form.wouldRepeat),
      reason: form.reason.trim(),
    };

    const pnl = calculatePnl(normalizedTrade.type, buy, sell);

    const base = baseScore({
      followedPlan: normalizedTrade.followedPlan,
      emotion: normalizedTrade.emotion,
      hasReason: !!normalizedTrade.reason,
      wouldRepeat: normalizedTrade.wouldRepeat,
      timeframe: normalizedTrade.timeframe,
    });

    const tradesForPenalty =
      editingTradeId === null
        ? trades
        : trades.filter((trade) => trade.id !== editingTradeId);

    const penalty = patternPenalty(tradesForPenalty, normalizedTrade as Partial<Trade>);
    const score = Math.max(0, Math.min(10, base - penalty));

    const trade: Trade = {
      id: editingTradeId ?? Date.now(),
      ...normalizedTrade,
      pnl,
      score,
      luckLabel: luckLabel(score, pnl),
      insight: "",
    };

    trade.insight = makeInsight(trade);

    if (editingTradeId !== null) {
      const { error } = await supabase
  .from("trades")
  .update({
    ticker: trade.ticker,
    type: trade.type,
    buy: trade.buy,
    sell: trade.sell,
    timeframe: trade.timeframe,
    emotion: trade.emotion,
    followed_plan: trade.followedPlan,
    would_repeat: trade.wouldRepeat,
    reason: trade.reason,
    pnl: trade.pnl,
    score: trade.score,
    luck_label: trade.luckLabel,
    insight: trade.insight,
  })
.eq("id", editingTradeId)
.eq("user_id", user.id);
      console.log("UPDATE ERROR:", error);

      if (error) {
        alert("Could not update trade.");
        return;
      }

      const nextTrades = trades.map((existingTrade) =>
        existingTrade.id === editingTradeId ? trade : existingTrade
      );

      setTrades(nextTrades);
      setSelectedTrade(trade);
      setEditingTradeId(null);
    } else {
     const { data, error } = await supabase
  .from("trades")
  .insert([
    {
      user_id: user.id,
      ticker: trade.ticker,
      type: trade.type,
      buy: trade.buy,
      sell: trade.sell,
      timeframe: trade.timeframe,
      emotion: trade.emotion,
      followed_plan: trade.followedPlan,
      would_repeat: trade.wouldRepeat,
      reason: trade.reason,
      pnl: trade.pnl,
      score: trade.score,
      luck_label: trade.luckLabel,
      insight: trade.insight,
    },
  ])
  .select()
  .single();

      console.log("INSERT ERROR:", error);

      if (error || !data) {
        alert("Could not save trade.");
        return;
      }

      const savedTrade: Trade = {
        id: data.id,
        ticker: data.ticker,
        type: data.type,
        buy: Number(data.buy),
        sell: Number(data.sell),
        timeframe: data.timeframe,
        emotion: data.emotion,
        followedPlan: data.followed_plan,
        wouldRepeat: data.would_repeat,
        reason: data.reason,
        pnl: Number(data.pnl),
        score: Number(data.score),
        luckLabel: data.luck_label,
        insight: data.insight,
      };

      const nextTrades = [savedTrade, ...trades];
      setTrades(nextTrades);
      setSelectedTrade(savedTrade);
    }

    setForm(initialForm);
    setActivePage("dashboard");
  }

  async function handleDelete(tradeId: number) {
    const confirmed = window.confirm("Delete this trade?");
    if (!confirmed) return;

    const { error } = await supabase
  .from("trades")
  .delete()
  .eq("id", tradeId)
  .eq("user_id", user.id);

    console.log("DELETE ERROR:", error);

    if (error) {
      alert("Could not delete trade from Supabase.");
      return;
    }

    const nextTrades = trades.filter((trade) => trade.id !== tradeId);
    setTrades(nextTrades);

    if (selectedTrade?.id === tradeId) {
      setSelectedTrade(nextTrades.length ? nextTrades[0] : null);
    }

    if (editingTradeId === tradeId) {
      setEditingTradeId(null);
      setForm(initialForm);
    }

    setActivePage("dashboard");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setTrades([]);
    setSelectedTrade(null);
    setEditingTradeId(null);
    setForm(initialForm);
    setActivePage("dashboard");
  }

  function handleReset() {
    setTrades([]);
    setSelectedTrade(null);
    setEditingTradeId(null);
    setForm(initialForm);
    setActivePage("dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">TradeMind</p>
            <p className="text-sm text-slate-400">Journal</p>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <nav className="flex items-center gap-2">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActivePage(item.id)}
                      className={`rounded-2xl px-4 py-2 text-sm transition ${
                        activePage === item.id
                          ? "bg-white text-slate-950"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>

                <button
                  onClick={handleReset}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
                >
                  Reset
                </button>

                <button
                  onClick={handleSignOut}
                  className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
                >
                  Sign Out
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main>
        {!user ? (
          <div className="px-6 py-10 lg:px-10">
            <AuthBox />
          </div>
        ) : (
          <>
            {activePage === "dashboard" && (
              <DashboardPage
                trades={trades}
                selectTrade={setSelectedTrade}
                goTo={setActivePage}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isLoading={isLoading}
              />
            )}
            {activePage === "log" && (
              <LogTradePage
                form={form}
                setForm={setForm}
                onSave={handleSave}
                goTo={setActivePage}
                coachPreview={coachPreview}
                isEditing={editingTradeId !== null}
                onCancelEdit={handleCancelEdit}
              />
            )}
            {activePage === "breakdown" && (
              <BreakdownPage
                trade={selectedTrade}
                goTo={setActivePage}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isLoading={isLoading}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}