import { RotateCw } from "lucide-react";

// 選択中の画像を90度回すボタン。投稿・編集・追記の3つのフォームが同じ形で使う。
//
// 位置と大きさは隣の削除（×）に揃えてある。押す先が違うだけの操作を別の見た目にすると、
// 「これは何を消すボタンなのか」を毎回読み直すことになるため。
type Props = {
  /** 読み上げ用。どの画像を回すのかを名前で示す（サムネイルは並ぶので位置では特定できない） */
  fileName: string;
  disabled?: boolean;
  onClick: () => void;
};

export function RotateImageButton({ fileName, disabled = false, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${fileName} を右に90度回転`}
      // 読み上げは aria-label が勝つので二重には読まれない。マウスの人にだけ役割を見せる
      title="右に90度回転"
      className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-white hover:bg-gray-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RotateCw className="h-3 w-3" aria-hidden />
    </button>
  );
}
