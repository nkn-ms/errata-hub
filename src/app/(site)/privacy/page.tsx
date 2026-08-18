import type { Metadata } from "next";
import Link from "next/link";
import { Article, BulletList, OrderedList } from "@/components/legal";
import { LegalShell } from "@/components/layout/legal-shell";
import { routes } from "@/constants/routes";
import { site } from "@/constants/site";

export const metadata: Metadata = {
  title: "プライバシーポリシー | Errata Hub",
  description: "Errata Hub における個人情報の取り扱いについて定めたプライバシーポリシーです。",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="プライバシーポリシー">
      <p>
        個人として本サービスを運営する nkn-ms（以下「運営者」といいます）は、運営するサービス「Errata
        Hub」（以下「本サービス」といいます）における利用者の個人情報を、以下の方針に基づいて取り扱います。
      </p>

      <Article heading="第1条（基本方針）">
        <p>
          運営者は、個人情報の保護に関する法令その他の規範を遵守し、利用者の個人情報を適切に取り扱います。
        </p>
      </Article>

      <Article heading="第2条（取得する情報）">
        <p>運営者は、本サービスの提供にあたり、以下の情報を取得します。</p>
        <OrderedList>
          <li>
            <strong>アカウント情報</strong>
            <BulletList>
              <li>メールアドレス（アカウント登録・認証・連絡のため）</li>
              <li>表示名（投稿に紐づいて公開されます）</li>
              <li>
                パスワードは認証基盤（Supabase
                Authentication）にてハッシュ化等の安全な形式で管理され、運営者が平文のパスワードを取得・閲覧することはありません。
              </li>
              <li>
                利用規約に同意した日時と、その時点の規約の版（同意の記録として保存します。公開されません）
              </li>
            </BulletList>
          </li>
          <li>
            <strong>投稿に関する情報</strong>
            <BulletList>
              <li>
                投稿された正誤情報・改善提案等の内容、対象書籍、該当箇所、添付画像（実装時）など。これらは公開情報として扱われます。
              </li>
            </BulletList>
          </li>
          <li>
            <strong>ログ情報</strong>
            <BulletList>
              <li>
                本サービスの稼働基盤（ホスティング・認証基盤等）が自動的に記録する IP
                アドレス、ブラウザの種類（ユーザーエージェント）、アクセス日時等の情報。
              </li>
              <li>本サービス内の操作ログ（管理者による操作の記録等。以下「監査ログ」といいます）。</li>
            </BulletList>
          </li>
          <li>
            <strong>アクセス解析・広告に関する情報</strong>
            <BulletList>
              <li>
                アクセス解析ツール、および（広告を掲載する場合）広告配信事業者を通じて取得される、閲覧ページ・参照元・おおよその地域・端末種別等の情報（詳細は第5条）。
              </li>
            </BulletList>
          </li>
        </OrderedList>
      </Article>

      <Article heading="第3条（利用目的）">
        <p>運営者は、取得した情報を以下の目的で利用します。</p>
        <OrderedList>
          <li>本サービスの提供、本人認証、アカウントの管理</li>
          <li>投稿の公開・表示・共有</li>
          <li>パスワード再発行その他、本サービスの運営に必要な連絡</li>
          <li>不正利用の防止、セキュリティの確保、および本サービスの維持・改善</li>
          <li>利用規約に違反する行為への対応</li>
          <li>利用状況の把握・分析による本サービスの改善（アクセス解析）</li>
          <li>広告の配信および効果測定（本サービスが広告を掲載する場合）</li>
          <li>法令に基づく対応</li>
        </OrderedList>
      </Article>

      <Article heading="第4条（第三者提供および委託）">
        <OrderedList>
          <li>運営者は、法令で認められる場合を除き、利用者の同意なく個人情報を第三者に提供しません。</li>
          <li>
            運営者は、本サービスの提供に必要な範囲で、以下の外部サービスに個人情報の取り扱いを委託し、または本サービスの機能上これらを利用します。
            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-300 text-gray-500">
                    <th className="py-1.5 pr-3 font-medium">委託先・利用先</th>
                    <th className="py-1.5 pr-3 font-medium">用途</th>
                    <th className="py-1.5 font-medium">取り扱われ得る情報</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-b border-gray-200">
                    <td className="py-1.5 pr-3">Supabase（認証・データベース基盤）</td>
                    <td className="py-1.5 pr-3">認証、データ保存</td>
                    <td className="py-1.5">メールアドレス、表示名、投稿、ログ等</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3">Vercel（ホスティング基盤）</td>
                    <td className="py-1.5 pr-3">本サービスの配信、アクセスログ</td>
                    <td className="py-1.5">IP アドレス、アクセス情報等</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2">
              なお、書籍の書誌情報・書影は外部の書籍データベース（OpenBD・Google
              Books）から取得しますが、その際に利用者の個人情報（氏名・メールアドレス等）を送信することはありません（送信するのは書籍の
              ISBN・検索語のみです）。
            </p>
          </li>
          <li>
            上記の委託先・利用先のサーバーは日本国外（米国等）に所在する場合があり、その場合、個人情報が外国に移転されることがあります。利用者は、本サービスを利用することにより、本サービスの提供に必要な範囲で、これらの外国に所在する委託先・利用先において個人情報が取り扱われることに同意するものとします。
          </li>
        </OrderedList>
      </Article>

      <Article heading="第5条（Cookie・アクセス解析・広告／外部送信について）">
        <OrderedList>
          <li>本サービスは、ログイン状態の維持等、サービスの提供に必要な範囲で Cookie 等を使用します。</li>
          <li>
            <strong>アクセス解析</strong>：本サービスは、利用状況の把握・改善のため、アクセス解析ツール「Vercel
            Web Analytics」を使用します。同ツールは <strong>Cookie を使用せず</strong>
            、個人を直接特定しない形で集計されたアクセス情報（閲覧ページ、参照元、おおよその地域、端末種別等）を取得します。
          </li>
          <li>
            <strong>広告</strong>：本サービスは、その運営の維持のため、第三者配信の広告サービス（Google
            AdSense
            等）を利用して広告を掲載する場合があります。広告を掲載する場合、当該広告事業者は、利用者の興味・関心に応じた広告（パーソナライズ広告）を表示する目的等で
            Cookie 等を使用し、本サービスへのアクセス情報を取得することがあります。
            <BulletList>
              <li>
                利用者は、Google の広告設定ページ（{" "}
                <a
                  href="https://adssettings.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  https://adssettings.google.com/
                </a>{" "}
                ）等から、パーソナライズ広告を無効にすることができます。
              </li>
              <li>
                第三者配信事業者による Cookie
                の利用については、各事業者のプライバシーポリシーをご確認ください。
              </li>
            </BulletList>
          </li>
          <li>
            <strong>外部送信について</strong>
            ：本サービスの利用にあたり、利用者の端末から外部事業者へ送信される情報の概要は以下のとおりです。
            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-300 text-gray-500">
                    <th className="py-1.5 pr-3 font-medium">送信先</th>
                    <th className="py-1.5 pr-3 font-medium">送信され得る情報</th>
                    <th className="py-1.5 pr-3 font-medium">目的</th>
                    <th className="py-1.5 font-medium">Cookie</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <tr className="border-b border-gray-200">
                    <td className="py-1.5 pr-3">Vercel Web Analytics</td>
                    <td className="py-1.5 pr-3">
                      閲覧ページ・参照元・おおよその地域・端末種別等の集計情報
                    </td>
                    <td className="py-1.5 pr-3">利用状況の分析・改善</td>
                    <td className="py-1.5">使用しない</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3">
                      Google（AdSense 等の広告配信）※広告掲載時のみ
                    </td>
                    <td className="py-1.5 pr-3">アクセス情報、広告識別のための Cookie 情報</td>
                    <td className="py-1.5 pr-3">広告配信・効果測定</td>
                    <td className="py-1.5">使用する</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </li>
          <li>
            欧州経済領域（EEA）・英国その他、適用される法令により事前の同意が必要とされる地域の利用者に対しては、当該法令に従い、パーソナライズ広告の表示等について同意取得の手段を講じます。
          </li>
          <li>
            本サービスは、上記以外に利用者を追跡することのみを目的とした Cookie
            を使用しません。アクセス解析・広告の利用内容に重要な変更があった場合は、本ポリシーを改定し、その旨を周知します。
          </li>
        </OrderedList>
      </Article>

      <Article heading="第6条（保存期間・退会時の取り扱い）">
        <OrderedList>
          <li>アカウント情報は、アカウントが存続する間、保有します。</li>
          <li>
            監査ログ・アクセスログは、その保有の必要がなくなった後、90日を目安に削除するよう努めます（自動削除の仕組みは順次整備します）。
          </li>
          <li>
            利用者が退会した場合、運営者は、認証情報および登録メールアドレス・表示名等の個人を特定し得る情報を削除または匿名化します。
          </li>
          <li>
            <strong>
              退会後も、利用者の過去の投稿は、投稿者を「退会済みユーザー」と表示する匿名化された形で本サービス上に残ります
            </strong>
            （利用規約
            第5条参照）。匿名化された投稿は、特定の個人を識別できる情報を含まないものとして扱います。
          </li>
        </OrderedList>
      </Article>

      <Article heading="第7条（開示・訂正・利用停止等の請求）">
        <OrderedList>
          <li>
            利用者は、自己の個人情報について、開示・訂正・追加・削除・利用停止・第三者提供の停止を請求することができます。
          </li>
          <li>
            前項の請求は、第9条の問い合わせ窓口にて受け付けます。運営者は、本人からの請求であることを確認のうえ、法令に従い合理的な期間内に対応します。
          </li>
          <li>
            表示名の変更、およびアカウントの削除（退会）は、本サービス上の操作によって利用者自身が行えます。
          </li>
        </OrderedList>
      </Article>

      <Article heading="第8条（安全管理措置）">
        <p>
          運営者は、個人情報の漏えい、滅失または毀損の防止その他の安全管理のために、認証基盤・ホスティング基盤の提供する保護機能の活用、アクセス権限の制限、秘密情報（認証用キー等）の適切な管理等、合理的な措置を講じます。
        </p>
      </Article>

      <Article heading="第9条（運営者情報・お問い合わせ窓口）">
        <OrderedList>
          <li>
            本ポリシーおよび個人情報の取り扱いに関するお問い合わせ・請求は、以下の窓口までご連絡ください。
            <BulletList>
              <li>運営者：nkn-ms（個人）</li>
              <li>
                連絡先：
                <a href={`mailto:${site.contactEmail}`} className="text-blue-600 hover:underline">
                  {site.contactEmail}
                </a>
              </li>
            </BulletList>
          </li>
          <li>
            本サービスは個人が運営しており、運営者の氏名（戸籍上の氏名）および住所は、個人情報の保護に関する法令に基づく開示等の請求その他正当な理由のある請求に応じて、本人確認のうえ遅滞なく回答します。
          </li>
        </OrderedList>
      </Article>

      <Article heading="第10条（本ポリシーの変更）">
        <p>
          運営者は、必要に応じて本ポリシーを変更することがあります。変更後のポリシーは、本サービス上に掲示した時点から効力を生じます。重要な変更については、合理的な方法で周知するよう努めます。
        </p>
      </Article>

      <div className="border-t border-gray-200 pt-6 text-xs text-gray-500 space-y-1">
        <p>制定日：2026年7月29日</p>
        <p>運営者：nkn-ms（個人）</p>
        <p className="pt-2">
          関連文書：
          <Link href={routes.terms} className="text-blue-600 hover:underline">
            利用規約
          </Link>
        </p>
      </div>
    </LegalShell>
  );
}
