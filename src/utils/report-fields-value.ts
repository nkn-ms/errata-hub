import type { ReportFieldsValue } from "@/components/report-fields";

// DB の1行を編集フォームの初期値に落とす。
//
// ⚠️ **数値と null の扱いがここの肝**。フォームは数値欄を文字列で持つ（全角のまま一時的に
//    保持され、blur で半角に直る = NumberField）ので、null は "" に、数値は文字列にする。
//    `String(null)` は "null" になるため、素直に書ける形に見えても ?? で先に潰しておく。
//    同じ理由で、テキスト欄の null も "" にする（value={null} は非制御の input になる）。
type ReportRow = {
  edition: number | null;
  printing: number | null;
  type: string;
  medium: string;
  page: number | null;
  line: number | null;
  hasMultiplePages: boolean;
  locationNote: string | null;
  ebookLocation: string | null;
  title: string;
  wrong: string | null;
  correct: string | null;
  content: string | null;
  note: string | null;
};

const numberToField = (value: number | null) => (value === null ? "" : String(value));

export function toReportFieldsValue(report: ReportRow): ReportFieldsValue {
  return {
    edition: numberToField(report.edition),
    printing: numberToField(report.printing),
    // 型は DB の enum そのままなので、フォーム側の union と一致する（値が増えたら tsc が気づく）
    reportType: report.type as ReportFieldsValue["reportType"],
    medium: report.medium as ReportFieldsValue["medium"],
    page: numberToField(report.page),
    line: numberToField(report.line),
    hasMultiplePages: report.hasMultiplePages,
    locationNote: report.locationNote ?? "",
    ebookLocation: report.ebookLocation ?? "",
    title: report.title,
    wrong: report.wrong ?? "",
    correct: report.correct ?? "",
    content: report.content ?? "",
    note: report.note ?? "",
  };
}
