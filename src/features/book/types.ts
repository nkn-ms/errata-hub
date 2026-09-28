// 操作（usecases）の戻り値で、画面の useActionState が持つ形。
// ⚠️ 複数の usecases が返すので、どれか1本の中ではなくここに置く。

export type BookActionState = { error?: string };
