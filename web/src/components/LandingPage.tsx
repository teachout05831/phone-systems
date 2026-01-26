'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function LandingPage() {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="flex justify-between items-center px-[5%] py-6">
        <div className="text-[1.75rem] font-extrabold tracking-tight">
          Dial<span className="text-orange-500">Pro</span>
        </div>
        <Link
          href="/login"
          className="px-8 py-3 border-2 border-orange-500 rounded-full font-semibold hover:bg-orange-500 transition-all"
        >
          Login
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="max-w-[1200px] mx-auto px-8 py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <h1 className="text-5xl lg:text-6xl font-extrabold leading-[1.05] mb-6 tracking-tight">
            Your Team. <span className="text-orange-500">10x Faster.</span>
          </h1>
          <p className="text-xl text-zinc-400 mb-10 leading-relaxed">
            AI that listens, coaches, and closes. Stop leaving money on the table with outdated dialing systems.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-block bg-gradient-to-r from-orange-500 to-orange-600 px-12 py-5 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-[0_0_60px_rgba(249,115,22,0.3)] hover:shadow-[0_0_60px_rgba(249,115,22,0.5)] cursor-pointer"
          >
            Start Closing Deals →
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl p-8 text-center">
            <div className="text-5xl font-extrabold text-orange-500 mb-2">47%</div>
            <div className="text-zinc-400 text-sm uppercase tracking-wider">More Connections</div>
          </div>
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl p-8 text-center">
            <div className="text-5xl font-extrabold text-orange-500 mb-2">3.2x</div>
            <div className="text-zinc-400 text-sm uppercase tracking-wider">Close Rate</div>
          </div>
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl p-8 text-center">
            <div className="text-5xl font-extrabold text-orange-500 mb-2">24/7</div>
            <div className="text-zinc-400 text-sm uppercase tracking-wider">AI Coaching</div>
          </div>
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl p-8 text-center">
            <div className="text-5xl font-extrabold text-orange-500 mb-2">100%</div>
            <div className="text-zinc-400 text-sm uppercase tracking-wider">Calls Recorded</div>
          </div>
        </div>
      </section>

      {/* Bottom Bar */}
      <div className="bg-zinc-900 py-12 mt-16">
        <div className="flex flex-wrap justify-center gap-12 text-zinc-400">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📞</span> Smart Dialing
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span> AI Coaching
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📈</span> Live Analytics
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">👥</span> Team Management
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Get Started</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <p className="text-zinc-400 mb-6">Submit your information and we&apos;ll get you set up.</p>

            <form className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Full Name</label>
                <input
                  type="text"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Email</label>
                <input
                  type="email"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                  placeholder="john@company.com"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Phone Number</label>
                <input
                  type="tel"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Company</label>
                <input
                  type="text"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                  placeholder="Acme Inc."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 py-4 rounded-lg font-bold text-lg hover:scale-[1.02] transition-transform mt-6"
              >
                Submit
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
