import PublisherForm from "@/features/publisher/components/admin/publisher-form";

export default function NewPublisherPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">出版社を追加</h1>
      </div>
      <PublisherForm />
    </div>
  );
}
