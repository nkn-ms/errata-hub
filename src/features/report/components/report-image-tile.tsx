import type { ComponentProps, ReactNode } from "react";
import { RotateCcw, RotateCw, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RotateDirection } from "@/features/report/utils/selected-images";

// 添付画像のサムネイル1枚ぶんの枠と、その下に並ぶ操作ボタン。投稿・編集・追記の3つのフォームが同じ形で使う。
//
// ボタンを画像の角に重ねず下に並べるのは、押し間違いを防ぐため。角に置いていたときは、
// 画像の外にはみ出したボタンが隣の画像のボタンと重なっていた（左の画像の × と右の画像の回転）。
// 並びは「回転は左・削除は右端」で、削除は取り消せない（選び直しになる）ので回転から離して置く。
//
// 枠の幅を固定するのは、縦長の画像でもボタン3つが横に収まる幅を確保するため。
type TileProps = {
  /** サムネイル。幅は w-full で枠に合わせる */
  children: ReactNode;
  /** 左に寄せる操作（回転）。投稿済みの画像は回せないので無い */
  rotate?: ReactNode;
  /** 右端に置く操作（削除・削除の取り消し） */
  remove: ReactNode;
};

export function ImageTile({ children, rotate, remove }: TileProps) {
  return (
    <div className="w-32">
      {/* 「削除予定」の帯など、サムネイルに重ねる表示の基準 */}
      <div className="relative">{children}</div>
      <div className="mt-1 flex items-center justify-between">
        <div className="flex gap-1">{rotate}</div>
        {remove}
      </div>
    </div>
  );
}

function IconButton(props: ComponentProps<"button">) {
  return (
    <Button
      type="button"
      variant="secondary"
      className="flex h-8 w-8 items-center justify-center p-0"
      {...props}
    />
  );
}

type RotateProps = {
  /** 読み上げ用。どの画像を回すのかを名前で示す（サムネイルは並ぶので位置では特定できない） */
  fileName: string;
  disabled?: boolean;
  onRotate: (direction: RotateDirection) => void;
};

// 左回りと右回りの2つを置くのは、横倒しの写真がどちらに倒れているかは構え方しだいで決まらないため。
// 片方だけだと、逆に倒れた写真は3回押すことになる
//
// 並びは「右回り → 左回り」で、矢印の先が互いに内側を向く。
export function RotateImageButtons({ fileName, disabled = false, onRotate }: RotateProps) {
  return (
    <>
      <IconButton
        onClick={() => onRotate("right")}
        disabled={disabled}
        aria-label={`${fileName} を右に90度回転`}
        // 読み上げは aria-label が勝つので二重には読まれない。マウスの人にだけ役割を見せる
        title="右に90度回転"
      >
        <RotateCw className="h-4 w-4" aria-hidden />
      </IconButton>
      <IconButton
        onClick={() => onRotate("left")}
        disabled={disabled}
        aria-label={`${fileName} を左に90度回転`}
        title="左に90度回転"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
      </IconButton>
    </>
  );
}

type RemoveProps = {
  /** 読み上げ用。何を消すのか（または消すのをやめるのか）を言う */
  label: string;
  /** 削除の取り消し（↩）として出すか。編集画面の投稿済み画像は、押しても「削除予定」の印が付くだけで戻せる */
  undo?: boolean;
  onClick: () => void;
};

export function RemoveImageButton({ label, undo = false, onClick }: RemoveProps) {
  return (
    <IconButton onClick={onClick} aria-label={label} title={undo ? "削除をやめる" : "削除"}>
      {undo ? <Undo2 className="h-4 w-4" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
    </IconButton>
  );
}
