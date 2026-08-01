// Publisher.emailDomain の正規化と検証。
//
// この値は「その出版社の担当者が使っている企業ドメイン」を管理者が控えておくための**メモ**。
// ⚠️ **権限は付かない**。出版社アクセスは管理画面のユーザー編集からの個別付与だけで与える
//    （= actions/user.ts の grantPublisherAccess）。
//    以前はログイン時にこの値とメールのドメイン部を突き合わせて PublisherAccess を自動付与していたが、
//    「人の判断を経ずに、そのドメインの登録者全員へ常時付与される」形だったため廃止した
//    （退職者・大企業の無関係な人・後からそのドメインのアドレスを取得した人にも付いてしまう）。
//
// メモなのに形を検証するのは、**担当者の所属を確かめる一次資料として使う**ため。
// `@example.com` や URL が混ざっていると照合の役に立たない。自由記述は note 欄が持つ。
// ドメイン名は大文字小文字を区別しない（RFC 1035）ので、小文字に寄せて保存する。

/** 入力・比較の前に必ず通す正規化。前後の空白を落とし小文字に寄せる。 */
export function normalizeEmailDomain(raw: string): string {
  return raw.trim().toLowerCase();
}

// ラベル（英数字とハイフン・両端はハイフン不可）をドットで2つ以上つないだ形。
// 例: example.com / example.co.jp。@ や / を含むもの、単一ラベル（localhost）は弾く。
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** 正規化済みの文字列がドメインの形をしているか。空文字（未設定）は呼び出し側で扱う。 */
export function isValidEmailDomain(normalized: string): boolean {
  return DOMAIN_PATTERN.test(normalized);
}
