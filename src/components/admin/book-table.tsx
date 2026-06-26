"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/constants/routes";

type BookRow = {
  id: string;
  title: string;
  author: string | null;
  isbn: string;
  publisherName: string | null;
  reportCount: number;
};

export function AdminBookTable({ books }: { books: BookRow[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleDelete(book: BookRow) {
    if (!confirm(`「${book.title}」を削除しますか？この操作は取り消せません。`)) return;
    setDeletingId(book.id);
    setError("");
    try {
      const res = await fetch(routes.api.book(book.id), { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "削除に失敗しました");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-700">書籍名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">著者</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">ISBN</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">出版社</th>
              <th className="text-left px-4 py-3 font-medium text-gray-700">投稿数</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {books.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  書籍が登録されていません
                </td>
              </tr>
            )}
            {books.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{b.title}</td>
                <td className="px-4 py-3 text-gray-600">{b.author ?? "-"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">{b.isbn}</td>
                <td className="px-4 py-3 text-gray-600">{b.publisherName ?? "-"}</td>
                <td className="px-4 py-3 text-gray-600">{b.reportCount}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(b)}
                    disabled={deletingId === b.id}
                    className="text-red-600 hover:text-red-800 text-xs font-medium disabled:opacity-50"
                  >
                    {deletingId === b.id ? "削除中..." : "削除"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
