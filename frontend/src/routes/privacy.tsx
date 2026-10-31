import { LegalDocument } from '~/components/legal-document/LegalDocument';

const highlights = [
  {
    title: 'Minimal data',
    text: 'We only collect what we need to run your account and your matches.',
  },
  {
    title: 'No selling',
    text: 'Your data is never sold or used for advertising.',
  },
  {
    title: 'Your control',
    text: 'Access, fix or delete your data at any time.',
  },
];

const sections = [
  {
    id: 'collect',
    title: 'Data we collect',
    paragraphs: [
      'When you sign up, we collect your email address, your username and your password (stored hashed, never in clear).',
      'While you play, we also store your avatar, your match history, your stats, your friends list and the chat messages you send.',
    ],
  },
  {
    id: 'usage',
    title: 'How we use it',
    paragraphs: [
      'We use your data to run Neon Tank Lab: authenticating you, matching you with other pilots, showing leaderboards and keeping the game fair.',
      'We may also use it to detect cheating, bots and abuse, and to fix bugs and improve the service.',
    ],
  },
  {
    id: 'sharing',
    title: 'Sharing and visibility',
    paragraphs: [
      'Your username, avatar and stats are visible to other pilots, for example on leaderboards, in matches and in chat. Your email and password are never shown to other users.',
      'We do not sell your data. We only share it with third parties when the law requires it.',
    ],
  },
  {
    id: 'security',
    title: 'Storage and security',
    paragraphs: [
      'We protect your data with hashed passwords, encrypted connections (HTTPS) and restricted access to our servers. No system is perfectly secure, so keep your own credentials private.',
      'We keep your data as long as your account is active. When you delete your account, your personal data is erased within [X days], except what we must keep by law.',
    ],
  },
  {
    id: 'rights',
    title: 'Your rights',
    paragraphs: [
      'Under the GDPR and RGPD, you can access your data, correct it, delete it, export it, or object to its processing. You can do most of this from your profile settings.',
      'For anything else, contact us and we will answer as soon as possible.',
    ],
  },
  {
    id: 'contact',
    title: 'Changes and contact',
    paragraphs: [
      'We may update this policy and will show the new date above. Continued use means you accept the update.',
      'Questions or requests: jsp@ft_transcendence.fr.',
    ],
  },
];

export default function Privacy() {
  return (
    <LegalDocument
      title="Privacy"
      accentTitle="Privacy"
      highlights={highlights}
      sections={sections}
    />
  );
}
