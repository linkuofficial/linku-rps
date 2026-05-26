import { Link } from 'wouter';

const LAST_UPDATED = 'May 26, 2026';

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-surface px-4 py-10 sm:px-6 lg:px-8">
            <Link
                href="/"
                aria-label="Back to Home"
                className="fixed left-3 top-1/2 z-30 -translate-y-1/2 border border-border bg-surface-container-lowest px-3 py-2 text-body-lg leading-none text-primary shadow-sm transition hover:opacity-70 sm:left-4"
            >
                ←
            </Link>
            <div className="mx-auto w-full max-w-3xl">
                <header className="mb-8 border-b border-border pb-4">
                    <p className="text-label-sm uppercase tracking-[0.16em] text-secondary">Legal</p>
                    <h1 className="mt-2 text-headline-lg text-primary">Privacy Policy</h1>
                    <p className="mt-2 text-body-md text-secondary">Last updated: {LAST_UPDATED}</p>
                </header>

                <main className="space-y-6 text-body-md text-primary">
                    <section className="space-y-2">
                        <h2 className="text-headline-md">1. Data Controller</h2>
                        <p>
                            Linku Tech operates this game service and acts as the data controller for the processing described in this policy.
                        </p>
                        <p>
                            Contact: info@linku.tech
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-headline-md">2. Data We Process</h2>
                        <p>To deliver real-time matches, we process:</p>
                        <ul className="list-disc space-y-1 pl-5 text-secondary">
                            <li>Room identifiers and reconnect tokens</li>
                            <li>Gameplay events (choices, rounds, scores, outcomes)</li>
                            <li>Chat messages and emoji reactions shared in rooms</li>
                            <li>Optional custom text entries for certain tools (for example wheel labels or draw names)</li>
                            <li>Language preference stored in your browser</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-headline-md">3. What We Do Not Collect</h2>
                        <ul className="list-disc space-y-1 pl-5 text-secondary">
                            <li>No account registration data (name, email, phone)</li>
                            <li>No advertising trackers or analytics SDKs</li>
                            <li>No cookies used for tracking profiles</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-headline-md">4. Legal Bases (GDPR)</h2>
                        <ul className="list-disc space-y-1 pl-5 text-secondary">
                            <li>Article 6(1)(b): processing required to provide the multiplayer game service</li>
                            <li>Article 6(1)(f): legitimate interests for abuse prevention, integrity, and security controls</li>
                            <li>Article 6(1)(a): optional browser preference storage where consent is required</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-headline-md">5. Storage and Retention</h2>
                        <p>
                            Room state is primarily handled in server memory for active sessions. Reconnect information and language preference may be stored in your browser local storage.
                        </p>
                        <p>
                            Active room data is removed when a room is no longer active according to service runtime rules.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-headline-md">6. International Transfers</h2>
                        <p>
                            Our infrastructure providers may process data in multiple regions. Where required, we apply transfer safeguards under GDPR (for example, contractual safeguards offered by providers).
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-headline-md">7. Your Rights</h2>
                        <p>Subject to GDPR, you may request access, rectification, erasure, restriction, objection, and portability where applicable.</p>
                        <p>You may also lodge a complaint with your local supervisory authority.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="text-headline-md">8. Contact</h2>
                        <p>For privacy requests, contact info@linku.tech.</p>
                    </section>
                </main>

            </div>
        </div>
    );
}
