'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@mysten/dapp-kit';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-[#e0e0e0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <img 
                src="/favicon-32x32.png" 
                alt="IoTrade Logo" 
                className="w-8 h-8"
              />
              <span className="text-xl font-bold text-[#2d2d2d]">
                IoTrade
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="/"
                className="text-[#2d2d2d] hover:text-[#56c214] font-medium transition-colors relative"
              >
                Home
              </Link>
              <Link
                href="/consumer"
                className="text-[#2d2d2d] hover:text-[#56c214] font-medium transition-colors relative"
              >
                Marketplace
              </Link>
              <Link
                href="/subscriber"
                className="text-[#2d2d2d] hover:text-[#56c214] font-medium transition-colors relative"
              >
                My Subscriptions
              </Link>
              <Link
                href="/provider"
                className="text-[#2d2d2d] hover:text-[#56c214] font-medium transition-colors relative"
              >
                Provider Dashboard
              </Link>
            </div>

            {/* Right side: Wallet Connect + Mobile Menu Button */}
            <div className="flex items-center gap-4">
              {/* Wallet Connect - Hidden on very small screens, shown on sm+ */}
              <div className="hidden sm:flex items-center">
                <ConnectButton />
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-[4px] text-[#2d2d2d] hover:text-[#56c214] hover:bg-[#f5f5f5] transition-colors"
                aria-label="Toggle mobile menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-[#e0e0e0] py-4">
              <div className="flex flex-col space-y-4">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[#2d2d2d] hover:text-[#56c214] font-medium transition-colors px-2 py-1"
                >
                  Home
                </Link>
                <Link
                  href="/consumer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[#2d2d2d] hover:text-[#56c214] font-medium transition-colors px-2 py-1"
                >
                  Marketplace
                </Link>
                <Link
                  href="/subscriber"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[#2d2d2d] hover:text-[#56c214] font-medium transition-colors px-2 py-1"
                >
                  My Subscriptions
                </Link>
                <Link
                  href="/provider"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[#2d2d2d] hover:text-[#56c214] font-medium transition-colors px-2 py-1"
                >
                  Provider Dashboard
                </Link>
                {/* Wallet Connect for Mobile */}
                <div className="sm:hidden pt-2 border-t border-[#e0e0e0]">
                  <ConnectButton />
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#e0e0e0] mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4 text-[#2d2d2d]">IoTrade</h3>
              <p className="text-[#333333] text-sm">
                Decentralized IoT data marketplace powered by Sui, Walrus, and Seal.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-4 text-[#2d2d2d]">Links</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/consumer" className="text-[#333333] hover:text-[#56c214] transition-colors">
                    Browse Data Feeds
                  </Link>
                </li>
                <li>
                  <Link href="/provider" className="text-[#333333] hover:text-[#56c214] transition-colors">
                    Become a Provider
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-4 text-[#2d2d2d]">Technology</h3>
              <ul className="space-y-2 text-sm text-[#333333]">
                <li>• Sui Blockchain</li>
                <li>• Walrus Storage</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-[#e0e0e0] text-center text-sm text-[#333333]">
            © 2024 IoTrade. Built for Sui Hackathon.
          </div>
        </div>
      </footer>
    </div>
  );
}
