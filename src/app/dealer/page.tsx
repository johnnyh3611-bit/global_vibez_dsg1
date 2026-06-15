import Link from "next/link";
import { DealerInterface } from "@/components/dealer/DealerInterface";
import { getSession } from "@/lib/auth";

export default async function DealerPage() {
  const session = await getSession();

  if (!session || !session.hasChair) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
        <h2 className="mb-4 text-2xl">Dealer Room Access Required</h2>
        <p>This area is for chair holders only. Purchase your share to enter.</p>
        {!session && (
          <Link
            href="/login?redirect=/dealer"
            className="mt-4 text-sm text-purple-300 transition-colors hover:text-purple-200"
          >
            Sign in with your wallet
          </Link>
        )}
        <Link
          href="/checkout"
          className="mt-4 rounded bg-purple-600 px-6 py-2 transition-colors hover:bg-purple-500"
        >
          Get Your Chair
        </Link>
      </div>
    );
  }

  return <DealerInterface />;
}
