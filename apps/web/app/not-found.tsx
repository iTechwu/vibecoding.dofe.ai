import Link from 'next/link';
import Image from 'next/image';
import { BRAND_CONFIG } from '@/config';

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center px-6 max-w-lg">
            <div className="flex items-center justify-center gap-3 mb-8">
              <Image
                src={BRAND_CONFIG.logo}
                alt={BRAND_CONFIG.name}
                width={40}
                height={40}
                className="rounded-lg"
              />
              <span className="text-xl font-bold text-foreground tracking-tight">
                {BRAND_CONFIG.name}
              </span>
            </div>

            <h1 className="text-8xl font-bold text-primary/20 mb-4 select-none">
              404
            </h1>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Page Not Found
            </h2>
            <p className="text-muted-foreground/60 mb-8">
              The page you&apos;re looking for doesn&apos;t exist or has been
              moved.
            </p>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-10 px-4 py-2 text-sm font-medium"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
