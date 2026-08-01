// Publisher.emailDomain の正規化と検証。
//
// ⚠️ この値は表示用のメモではなく**アクセス権を付与する条件そのもの**。
//    app/auth/callback/route.ts が、ログインした人のメールのドメイン部と**完全一致**で
//    Publisher を引き、一致した出版社の PublisherAccess を自動付与する。
//
// 完全一致なので入力の揺れがそのまま事故になる。しかも**どちらも無言で起きる**:
//   - 大文字（`Example.com`）や前後の空白 → 一致せず「設定したのに権限が付かない」
//   - `@example.com` / `https://example.com` のような貼り付け → 同上
//   - 逆に、フリーメール（gmail.com 等）を入れると**そのドメインの利用者全員**に権限が付く
//     （こちらは形式としては正しいので機械では弾けない ＝ 運用で気をつける）
//
// ドメイン名は大文字小文字を区別しない（RFC 1035）ので、小文字に寄せて保存・比較する。

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

// フリーメールのドメイン。Publisher.emailDomain には登録させない。
//
// なぜ常に誤りと言い切れるか: このサイトの出版社アクセスは**2経路で完結している**。
//   - ドメイン一括（この欄）… 企業ドメインの人をまとめて通す
//   - 個別付与（actions/user.ts の grantPublisherAccess）… 管理画面のユーザー編集から1人ずつ
// フリーメールの担当者は後者が正しい経路なので、この欄に入れる理由が存在しない。
// 一方で入れてしまうと**そのサービスの利用者全員**に出版社アクセスが付く（形式としては正しいので
// 形の検証では落ちない）＝影響が大きいわりに気づけないので、名指しで弾く。
//
// ⚠️ 網羅は狙わない。「一番やりがちな誤り」を止めるのが目的で、漏れたものは出版社画面の
//    アクセス権一覧（誰が持っているか）で気づける想定。増やすときはここに足すだけ。
const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.co.jp",
  "yahoo.com",
  "outlook.com",
  "outlook.jp",
  "hotmail.com",
  "hotmail.co.jp",
  "live.jp",
  "icloud.com",
  "me.com",
  "aol.com",
]);

/** 正規化済みの文字列がフリーメールのドメインか。 */
export function isFreeMailDomain(normalized: string): boolean {
  return FREE_MAIL_DOMAINS.has(normalized);
}
