import type { ReportFieldsValue } from "@/features/report/components/report-fields";
import type { Report } from "@/features/report/types";

// 表示用の投稿（DTO = types.ts の Report）を編集フォームの初期値に落とす。
//
// ⚠️ 空を "" にするのは、`String(null)` が "null" になるのと、value={undefined} が
//    非制御の input になるため。数値欄が文字列なのは NumberField の都合（全角を一時保持する）。
//
// ⚠️ **DB の行ではなく DTO を受け取る。** db/ が生の行を外に出さないので、
//    未入力は null ではなく undefined で来る（Report の省略可プロパティ）。
type ReportFields = Pick<
  Report,
  | "edition" | "printing" | "type" | "medium" | "page" | "line"
  | "hasMultiplePages" | "locationNote" | "ebookLocation"
  | "title" | "wrong" | "correct" | "content" | "note"
>;

const numberToField = (value: number | undefined) => (value === undefined ? "" : String(value));

export function toReportFieldsValue(report: ReportFields): ReportFieldsValue {
  return {
    edition: numberToField(report.edition),
    printing: numberToField(report.printing),
    // 型は DB の enum そのままなので、フォーム側の union と一致する（値が増えたら tsc が気づく）
    reportType: report.type,
    medium: report.medium,
    page: numberToField(report.page),
    line: numberToField(report.line),
    hasMultiplePages: report.hasMultiplePages ?? false,
    locationNote: report.locationNote ?? "",
    ebookLocation: report.ebookLocation ?? "",
    title: report.title,
    wrong: report.wrong ?? "",
    correct: report.correct ?? "",
    content: report.content ?? "",
    note: report.note ?? "",
  };
}
