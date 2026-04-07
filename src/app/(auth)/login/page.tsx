"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 6 || loading) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();

      if (data.success) {
        const redirect = searchParams.get("redirect") || "/";
        router.push(redirect);
        router.refresh();
      } else {
        setError(data.error || "인증에 실패했습니다");
        setShake(true);
        setPin("");
        setTimeout(() => setShake(false), 500);
        inputRef.current?.focus();
      }
    } catch {
      setError("서버에 연결할 수 없습니다");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-gradient-to-b from-indigo-50 to-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white text-2xl font-bold mb-4 shadow-lg">
            홍
          </div>
          <h1 className="text-2xl font-bold text-gray-900">홍아트 출석부</h1>
          <p className="text-gray-500 mt-1 text-sm">출석 관리 시스템에 로그인하세요</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-6 transition-transform ${
            shake ? "animate-shake" : ""
          }`}
          style={
            shake
              ? {
                  animation: "shake 0.4s ease-in-out",
                }
              : undefined
          }
        >
          <label
            htmlFor="pin"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            PIN 번호
          </label>
          <input
            ref={inputRef}
            id="pin"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ""));
              setError("");
            }}
            className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
            placeholder="------"
            disabled={loading}
            autoComplete="off"
          />

          {error && (
            <p className="mt-3 text-sm text-red-600 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={pin.length < 6 || loading}
            className="w-full mt-4 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                인증 중...
              </>
            ) : (
              "로그인"
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          6자리 PIN을 입력하세요
        </p>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
