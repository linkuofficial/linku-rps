import { Link } from 'wouter';

const LAST_UPDATED = 'May 26, 2026';

export default function CopyrightNoticePage() {
    const currentYear = new Date().getFullYear();

    return (
        <div className="min-h-screen bg-white px-4 py-10 sm:px-6 lg:px-8">
            <Link
                href="/"
                aria-label="Back to Home"
                className="fixed left-3 top-1/2 z-30 -translate-y-1/2 border border-border bg-white px-3 py-2 text-body-lg leading-none text-primary shadow-sm transition hover:opacity-70 sm:left-4"
            >
                ←
            </Link>
            <div className="mx-auto w-full max-w-3xl">
                <header className="mb-8 border-b border-border pb-4">
                    <p className="text-label-sm uppercase tracking-[0.16em] text-secondary">Legal</p>
                    <h1 className="mt-2 text-headline-lg text-primary">Copyright Notice</h1>
                    <p className="mt-2 text-body-md text-secondary">Last updated: {LAST_UPDATED}</p>
                </header>

                <main className="space-y-6 text-body-md text-primary">
                    <section className="space-y-2">
                        <h2 className="text-headline-md">1. Ownership</h2>
                        <p>
                            Unless otherwise stated, this service and its original content are Copyright © 2025-{currentYear} Linku Tech. All rights reserved.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-headline-md">2. Open Source Components</h2>
                        <p>
                            This service uses third-party open source software. Those components remain subject to their own licenses and copyright notices.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-headline-md">3. Permitted Use</h2>
                        <p>
                            You may use the service for lawful personal or business gameplay activities. You must not copy, resell, or redistribute protected content except where the applicable license expressly permits it.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-headline-md">4. IP Concerns</h2>
                        <p>
                            If you believe your copyright or other intellectual property rights are infringed, contact info@linku.tech with sufficient details.
                        </p>
                    </section>
                </main>

            </div>
        </div>
    );
}
