import { createSignal, onSettled } from "solid-js";

const sans = "font-['Space_Grotesk',sans-serif]";
const mono = "font-['Space_Mono',monospace]";

const panel =
    "bg-[rgba(10,15,33,0.92)] backdrop-blur-md border border-[rgba(23,42,77,0.85)] rounded-xl " +
    "shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08),inset_0_0_20px_0_rgba(0,240,255,0.02)]";

const neonText = "[text-shadow:0_0_10px_rgba(0,240,255,0.75),0_0_20px_rgba(0,240,255,0.35)]";

const highlights = [
    { title: "Minimal data", text: "We only collect what we need to run your account and your matches." },
    { title: "No selling", text: "Your data is never sold or used for advertising." },
    { title: "Your control", text: "Access, fix or delete your data at any time." },
];

const sections = [
    {
        id: "collect",
        title: "Data we collect",
        paragraphs: [
            "When you sign up, we collect your email address, your username and your password (stored hashed, never in clear).",
            "While you play, we also store your avatar, your match history, your stats, your friends list and the chat messages you send.",
        ],
    },
    {
        id: "usage",
        title: "How we use it",
        paragraphs: [
            "We use your data to run Neon Tank Lab: authenticating you, matching you with other pilots, showing leaderboards and keeping the game fair.",
            "We may also use it to detect cheating, bots and abuse, and to fix bugs and improve the service.",
        ],
    },
    {
        id: "sharing",
        title: "Sharing and visibility",
        paragraphs: [
            "Your username, avatar and stats are visible to other pilots, for example on leaderboards, in matches and in chat. Your email and password are never shown to other users.",
            "We do not sell your data. We only share it with third parties when the law requires it.",
        ],
    },
    {
        id: "security",
        title: "Storage and security",
        paragraphs: [
            "We protect your data with hashed passwords, encrypted connections (HTTPS) and restricted access to our servers. No system is perfectly secure, so keep your own credentials private.",
            "We keep your data as long as your account is active. When you delete your account, your personal data is erased within [X days], except what we must keep by law.",
        ],
    },
    {
        id: "rights",
        title: "Your rights",
        paragraphs: [
            "Under the GDPR and RGPD, you can access your data, correct it, delete it, export it, or object to its processing. You can do most of this from your profile settings.",
            "For anything else, contact us and we will answer as soon as possible.",
        ],
    },
    {
        id: "contact",
        title: "Changes and contact",
        paragraphs: [
            "We may update this policy and will show the new date above. Continued use means you accept the update.",
            "Questions or requests: jsp@ft_transcendence.fr.",
        ],
    },
];

export default function TermOfService() {
    const [scrolled, setScrolled] = createSignal(false);

    onSettled(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 190);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();

        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    });

    return (
        <main class={`relative min-h-screen overflow-x-hidden bg-[#050711] text-slate-200 ${sans} selection:bg-[#00f0ff] selection:text-[#050711]`}>
            <div class="fixed inset-0 z-0 pointer-events-none opacity-80" style={{"background-size": "32px 32px", "background-image": "linear-gradient(to right, rgba(0,240,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,240,255,0.05) 1px, transparent 1px)",}}/>
            <div class="fixed inset-0 z-50 pointer-events-none opacity-30" style={{"background-size": "100% 3px, 6px 100%", "background-image": "linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.35) 50%), linear-gradient(90deg, rgba(0,240,255,0.02), rgba(0,0,0,0.01), rgba(255,0,127,0.02))"}}/>
            <div class="fixed -top-40 -left-32 w-96 h-96 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
            <div class="fixed top-1/3 -right-40 w-96 h-96 rounded-full bg-fuchsia-600/15 blur-3xl pointer-events-none" />
            <div class="fixed -bottom-40 left-1/3 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />

            <header class="relative z-10 border-b border-[rgba(23,42,77,0.85)] bg-[#070b18]/90 backdrop-blur-md px-4 lg:px-8 py-3">
                <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <span class="inline-block w-2.5 h-2.5 bg-[#00f0ff] shadow-[0_0_20px_-2px_rgba(0,240,255,0.45)]" />
                        <div>
                            <div class="font-extrabold text-sm tracking-wider text-white">
                                FT_TRANSCENDENCE <span class="text-[#00f0ff]">/ NEON TANK LAB</span>
                            </div>
                            <div class={`${mono} text-[10px] text-slate-500 tracking-widest uppercase`}>
                                Tactical net // Privacy
                            </div>
                        </div>
                    </div>

                    <nav class={`flex items-center gap-4 ${mono} text-xs font-bold tracking-wider uppercase text-slate-400`}>
                        {/*
                        <a href="#" class="px-3 py-1 rounded bg-[#00f0ff] text-[#050711] shadow-[0_0_20px_-2px_rgba(0,240,255,0.45)]">Active header</a>
                        <a href="#" class="px-3 py-1 rounded transition-all hover:text-white hover:bg-[#101424]">Classic</a>
                        */}
                        <button type="button" class="px-3 py-1.5 rounded border border-[rgba(23,42,77,0.85)] text-slate-300 transition-all cursor-pointer hover:border-[#00f0ff]/60 hover:text-[#00f0ff]">
                            Back to sign in
                        </button>
                    </nav>
                </div>
            </header>

            <div class="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
                <aside class="lg:col-span-3">
                    <nav aria-label="Summary" class={`${panel} p-5 lg:sticky lg:top-6 transition-all duration-200 text-left font-ibm-plex-mono text-[#ffffff89] uppercase ${scrolled() ? "scrolled" : "border-[#00f0ff]/50 shadow-[0_0_20px_-2px_rgba(0,240,255,0.25)]"}`}>
                        <p class={`${mono} text-[11px] font-bold tracking-widest uppercase text-slate-400 pb-3 border-b border-[rgba(23,42,77,0.85)]`}>
                            Summary
                        </p>
                        <ol class={`${mono} text-xs uppercase mt-3 space-y-1`}>
                            {sections.map((s, i) => (
                                <li>
                                    <a href={`#${s.id}`} class="flex items-center gap-3 px-2 py-2 rounded-lg text-slate-400 transition-all hover:text-[#00f0ff] hover:bg-[#090e1f]">
                                        <span class="text-[#00f0ff] font-bold">{String(i + 1).padStart(2, "0")}</span>
                                        {s.title}
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </nav>
                </aside>

                <div class="lg:col-span-9 space-y-7 min-w-0">
                    <section class="space-y-2 border-b border-[rgba(23,42,77,0.7)] pb-6">
                        <div class="flex items-center gap-2">
                            <span class="inline-block w-2.5 h-2.5 bg-[#00f0ff] shadow-[0_0_20px_-2px_rgba(0,240,255,0.45)]" />
                            <span class={`${mono} text-xs font-bold tracking-widest text-[#00f0ff] uppercase`}>
                                // Legal / Privacy
                            </span>
                        </div>
                        <h1 class="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white uppercase">
                            <span class={`text-[#00f0ff] ${neonText}`}>Privacy</span>
                        </h1>
                        <p class={`${mono} text-xs md:text-sm text-slate-400 uppercase`}>
                            Last updated [DATE] // Version 0.1
                        </p>
                    </section>

                    <section class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {highlights.map((h) => (
                            <div class={`${panel} p-5 transition-all hover:border-[#00f0ff]/50`}>
                                <h2 class={`${mono} text-[13px] font-bold tracking-widest uppercase text-[#00f0ff] pb-2 flex items-center gap-2`}>
                                    <span class="w-1.5 h-1.5 bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]" />
                                    {h.title}
                                </h2>
                                <p class="text-white text-sm leading-relaxed">{h.text}</p>
                            </div>
                        ))}
                    </section>

                    {sections.map((s, i) => (
                        <section id={s.id} class={`${panel} p-6 sm:p-8 scroll-mt-6`}>
                            <p class={`${mono} text-xs font-bold tracking-widest uppercase text-[#00f0ff] pb-3`}>
                                {String(i + 1).padStart(2, "0")}
                            </p>
                            <h2 class="text-2xl font-bold text-white tracking-wide pb-3 border-b border-[rgba(23,42,77,0.85)]">
                                {s.title}
                            </h2>
                            <div class="mt-4 space-y-3">
                                {s.paragraphs.map((p) => (
                                    <p class="text-slate-300 leading-relaxed">{p}</p>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>

            <footer class={`relative z-10 border-t border-[rgba(23,42,77,0.85)] bg-[#060917] py-4 px-4 lg:px-8 mt-6 ${mono} text-xs text-slate-400`}>
                <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <span class="w-2 h-2 rounded-full bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]" />
                        <span class="text-slate-300 font-bold">NEON TANK / FT_TRANSCENDENCE</span>
                    </div>
                    {/*
                    <div class="flex items-center gap-6">
                        <a href="#" class="transition-colors hover:text-[#00f0ff]">Footer elm</a>
                    </div>
                    */}
                </div>
            </footer>
        </main>
    );
}
