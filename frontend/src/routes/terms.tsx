import { LegalDocument } from '~/components/legal-document/LegalDocument';

const highlights = [
  {
    title: 'Play fair',
    text: 'No cheating, bots or exploits. Win on the grid.',
  },
  {
    title: 'Stay safe',
    text: 'Keep your credentials private. You answer for your account.',
  },
  {
    title: 'Be decent',
    text: 'Respect other pilots in names, avatars and chat.',
  },
];

const sections = [
  {
    id: 'acceptance',
    title: 'Acceptance of terms',
    paragraphs: [
      'By creating an account or playing Neon Tank Lab, you agree to these terms. If you do not agree, please do not use the service.',
      'These terms apply to every visitor and registered pilot.',
    ],
  },
  {
    id: 'account',
    title: 'Your account',
    paragraphs: [
      'You must provide accurate information when you sign up, by email or through 42 sign-in, and keep your credentials secure.',
      'You are responsible for everything that happens under your account. Tell us at once if you suspect unauthorized access.',
    ],
  },
  {
    id: 'fairPlay',
    title: 'Fair play',
    paragraphs: [
      "Do not use cheats, bots, scripts or exploits, and do not interfere with matches or with other pilots' connections.",
      'Report bugs you find instead of abusing them.',
    ],
  },
  {
    id: 'conduct',
    title: 'Content and conduct',
    paragraphs: [
      'Usernames, avatars and chat messages must not be hateful, harassing, unlawful or misleading.',
      'We may remove content or rename accounts that break these rules.',
    ],
  },
  {
    id: 'contact',
    title: 'Changes and contact',
    paragraphs: [
      'We may update these terms and will show the new date above. Continued use means you accept the update.',
      'Questions: jsp@ft_transcendence.fr.',
    ],
  },
];

export default function Terms() {
  return (
    <LegalDocument
      title="Terms of service"
      titlePrefix="Terms of "
      accentTitle="Service"
      highlights={highlights}
      sections={sections}
    />
  );
}
