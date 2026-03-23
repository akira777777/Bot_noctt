import { fetchUsers } from "@/lib/admin-api";
import { UserTable } from "@/components/admin/user-table";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function UsersPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const { users, pagination } = await fetchUsers({ page, limit: 20 });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Пользователи</h1>

      <UserTable users={users} />

      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/users?page=${p}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                p === page ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
