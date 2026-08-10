import type { ReportFieldsValue } from "@/components/report-fields";

// DB の1行を編集フォームの初期値に落とす。
//
// ⚠️ null を "" にするのは、`String(null)` が "null" になるのと、value={null} が
//    非制御の input になるため。数値欄が文字列なのは NumberField の都合（全角を一時保持する）。
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
