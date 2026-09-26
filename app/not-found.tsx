import Link from 'next/link';
import { BrandMark } from '@/components/brand/brand-mark';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12 text-foreground">
      <div className="card w-full max-w-md p-6 text-center sm:p-8">
        <BrandMark size={32} className="mx-auto mb-4" />
        <h1 className="text-2xl font-semibold text-foreground">Not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That page, shop or creative does not exist — or is no longer in the index.
        </p>
        <Link href="/shops" className="btn-primary mt-6">Back to shops</Link>
      </div>
    </div>
  );
}
