"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        오류가 발생했습니다
      </h2>
      <p className="text-gray-500 mb-6">
        잠시 후 다시 시도해 주세요.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        다시 시도
      </button>
    </div>
  );
}
