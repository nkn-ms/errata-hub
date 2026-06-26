"use client";

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

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-700">書籍名</th>
            <th className="text-left px-4 py-3 font-medium text-gray-700">著者</th>
            <th className="text-left px-4 py-3 font-medium text-gray-700">ISBN</th>
            <th className="text-left px-4 py-3 font-medium text-gray-700">出版社</th>
            <th className="text-left px-4 py-3 font-medium text-gray-700">投稿数</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {books.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                書籍が登録されていません
              </td>
            </tr>
          )}
          {books.map((b) => (
            <tr
              key={b.id}
              onClick={() => router.push(routes.admin.book(b.id))}
              className="hover:bg-gray-50 cursor-pointer"
            >
              <td className="px-4 py-3 font-medium text-gray-900">{b.title}</td>
              <td className="px-4 py-3 text-gray-600">{b.author ?? "-"}</td>
              <td className="px-4 py-3 text-gray-500 text-xs font-mono">{b.isbn}</td>
              <td className="px-4 py-3 text-gray-600">{b.publisherName ?? "-"}</td>
              <td className="px-4 py-3 text-gray-600">{b.reportCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
