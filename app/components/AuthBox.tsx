"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthBox() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignUp() {
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Account created. Check your email if confirmation is required.");
  }

  async function handleSignIn() {
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Signed in successfully.");
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
      <h2 className="text-2xl font-semibold text-white">Sign in</h2>
      <p className="mt-1 text-sm text-slate-400">
        Create an account or sign into your TradeMind journal
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm text-slate-400">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-400">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40"
            placeholder="Password"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSignIn}
            className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950"
          >
            Sign In
          </button>

          <button
            onClick={handleSignUp}
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300"
          >
            Create Account
          </button>
        </div>

        {message ? <p className="text-sm text-slate-300">{message}</p> : null}
      </div>
    </div>
  );
}