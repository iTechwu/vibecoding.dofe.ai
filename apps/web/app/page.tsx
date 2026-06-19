import { BRAND_CONFIG } from '@/config';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4">{BRAND_CONFIG.name}</h1>
        <p className="text-2xl text-gray-500 mb-8">
          {BRAND_CONFIG.title}
        </p>
        <p className="text-lg mb-8">{BRAND_CONFIG.description}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <div className="border border-gray-300 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">📚 Documentation</h2>
            <p className="text-gray-600">
              Read the docs to learn about the architecture and best practices.
            </p>
          </div>

          <div className="border border-gray-300 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">🚀 Quick Start</h2>
            <p className="text-gray-600">
              Run{' '}
              <code className="bg-gray-100 px-2 py-1 rounded">pnpm dev</code> to
              start developing locally.
            </p>
          </div>

          <div className="border border-gray-300 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">🏗️ Architecture</h2>
            <p className="text-gray-600">
              4-layer architecture with type-safe API contracts using ts-rest.
            </p>
          </div>

          <div className="border border-gray-300 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">📦 Shared Packages</h2>
            <p className="text-gray-600">
              UI, utils, types, validators, and contracts shared across apps.
            </p>
          </div>

          <div className="border border-gray-300 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">🤖 Agents</h2>
            <p className="text-gray-600">
              Agent UI is planned; gateway and routing APIs are ready for model traffic today.
            </p>
          </div>

          <div className="border border-gray-300 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">🔒 Type Safety</h2>
            <p className="text-gray-600">
              Zod 4 validation + ts-rest for end-to-end type safety.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
