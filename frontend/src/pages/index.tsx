import Layout from '@/components/common/Layout';
import Link from 'next/link';

export default function Home() {
  return (
    <Layout>
      {/* Hero Section */}
      <div className="text-center py-20">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 text-[#2d2d2d]">
          Monetize Your IoT Data
        </h1>
        <p className="text-xl text-[#333333] mb-8 max-w-3xl mx-auto">
          The decentralized marketplace where IoT device owners earn revenue from their data streams
          and consumers access verified, real-time feeds.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/consumer"
            className="btn-primary text-lg px-8 py-4 inline-block"
          >
            Browse Data Feeds
          </Link>
          <Link
            href="/provider"
            className="btn-secondary text-lg px-8 py-4 inline-block"
          >
            Become a Provider
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
        <div className="card text-center">
          <div className="w-16 h-16 bg-[#f5f5f5] rounded-[4px] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#56c214]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2 text-[#2d2d2d]">Secure & Encrypted</h3>
          <p className="text-[#333333]">
            Premium feeds protected with Seal encryption. Your data stays private and secure.
          </p>
        </div>

        <div className="card text-center">
          <div className="w-16 h-16 bg-[#f5f5f5] rounded-[4px] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#56c214]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2 text-[#2d2d2d]">Real-time Streaming</h3>
          <p className="text-[#333333]">
            Live data updates via WebSocket. Get the freshest IoT data instantly.
          </p>
        </div>

        <div className="card text-center">
          <div className="w-16 h-16 bg-[#f5f5f5] rounded-[4px] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#56c214]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2 text-[#2d2d2d]">Fair Payments</h3>
          <p className="text-[#333333]">
            Automated payments via Sui smart contracts. Providers earn 95% of all revenue.
          </p>
        </div>
      </div>

      {/* How It Works */}
      <div className="mb-20">
        <h2 className="text-3xl font-bold text-center mb-12 text-[#2d2d2d]">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* For Providers */}
          <div className="card">
            <h3 className="text-2xl font-bold mb-6 text-[#2d2d2d]">For Data Providers</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-[#56c214] text-white rounded-[4px] flex items-center justify-center flex-shrink-0 font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold mb-1 text-[#2d2d2d]">Register Your Feed</h4>
                  <p className="text-[#333333] text-sm">
                    Connect your IoT device and create a data feed with pricing and metadata.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-[#56c214] text-white rounded-[4px] flex items-center justify-center flex-shrink-0 font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold mb-1 text-[#2d2d2d]">Upload Data</h4>
                  <p className="text-[#333333] text-sm">
                    Data is securely stored on Walrus with optional Seal encryption.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-[#56c214] text-white rounded-[4px] flex items-center justify-center flex-shrink-0 font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold mb-1 text-[#2d2d2d]">Earn Revenue</h4>
                  <p className="text-[#333333] text-sm">
                    Receive automatic payments in SUI when consumers subscribe to your feed.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* For Consumers */}
          <div className="card">
            <h3 className="text-2xl font-bold mb-6 text-[#2d2d2d]">For Data Consumers</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-[#56c214] text-white rounded-[4px] flex items-center justify-center flex-shrink-0 font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold mb-1 text-[#2d2d2d]">Browse Marketplace</h4>
                  <p className="text-[#333333] text-sm">
                    Explore available data feeds by category, location, and price.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-[#56c214] text-white rounded-[4px] flex items-center justify-center flex-shrink-0 font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold mb-1 text-[#2d2d2d]">Subscribe</h4>
                  <p className="text-[#333333] text-sm">
                    Choose pay-per-query or monthly subscription and pay with SUI.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-[#56c214] text-white rounded-[4px] flex items-center justify-center flex-shrink-0 font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold mb-1 text-[#2d2d2d]">Access Data</h4>
                  <p className="text-[#333333] text-sm">
                    Stream real-time data via API or WebSocket with verified access.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="card bg-[#2d2d2d] text-white mb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold mb-2">5%</div>
            <div className="text-gray-300">Platform Fee</div>
          </div>
          <div>
            <div className="text-4xl font-bold mb-2">Real-time</div>
            <div className="text-gray-300">Data Streaming</div>
          </div>
          <div>
            <div className="text-4xl font-bold mb-2">100%</div>
            <div className="text-gray-300">Decentralized</div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold mb-4 text-[#2d2d2d]">Ready to Get Started?</h2>
        <p className="text-xl text-[#333333] mb-8">
          Join the decentralized data economy today.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/consumer"
            className="btn-primary text-lg px-8 py-4 inline-block"
          >
            Explore Data Feeds
          </Link>
          <Link
            href="/provider"
            className="btn-secondary text-lg px-8 py-4 inline-block"
          >
            Start Earning
          </Link>
        </div>
      </div>
    </Layout>
  );
}
