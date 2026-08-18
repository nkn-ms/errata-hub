"use client";

import { useState } from "react";
import { BookSearch } from "@/features/book/components/book-search";
import { findErratumUrlByIsbn } from "@/features/book/actions/book";
import { BOOK_LABEL_ID, ReportForm } from "@/features/report/components/report-form";

// 投稿フォームは「投稿」と「書籍」の2つのフィーチャーにまたがる。
// どちらか一方に押し込むとフィーチャー同士が直接つながるので、**合成はここ（app 層）で行う**。
// 選んだ本の状態と、正誤表 URL の引き当てをここが持ち、フォームには結果だけを渡す。

type BookData = {
  googleBooksId: string;
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  coverImageUrl: string;
};

type Props = {
  /** 書籍ページの「この本に投稿する」から来たときに確定している本。通常の投稿では null */
  initialBook: BookData | null;
  /** 上と同じ経路で、サーバー側が既に知っている正誤表 URL */
  initialErratumUrl: string | null;
};

export function SubmitForm({ initialBook, initialErratumUrl }: Props) {
  const [book, setBook] = useState<BookData | null>(initialBook);
  const [knownErratumUrl, setKnownErratumUrl] = useState<string | null>(initialErratumUrl);

  // 確定済みで来たときは検索させない。ReportForm 側は「bookPicker が無い = 確定済み」で判断する
  const preselected = initialBook !== null;

  return (
    <ReportForm
      book={book}
      knownErratumUrl={knownErratumUrl}
      bookPicker={
        preselected ? undefined : (
          <BookSearch
            // 入力欄の名前として読ませる要素＝ReportForm 側の「書籍名」の見出し。
            // ⚠️ BookSearch の `role="group" aria-labelledby` は**グループに**名前を付けるだけで、
            //    中の入力欄には名前が付かない。だから同じ id を入力欄からも指す。
            labelledBy={BOOK_LABEL_ID}
            onSelect={async (selected) => {
              setBook(selected);
              setKnownErratumUrl(null);
              if (selected.isbn) {
                const { erratumUrl } = await findErratumUrlByIsbn(selected.isbn);
                setKnownErratumUrl(erratumUrl);
              }
            }}
          />
        )
      }
    />
  );
}
