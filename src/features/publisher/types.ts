// 操作（Server Action）の戻り値で、画面の useActionState が持つ形。
// ⚠️ 複数の Server Action が返すので、どれか1本の中ではなくここに置く。

export type PublisherState = { error?: string } | undefined;
