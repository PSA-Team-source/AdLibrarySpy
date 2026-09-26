import { redirect } from 'next/navigation';

// Sign-in is passwordless (one-time email links), so there is no password to
// reset; old reset links and bookmarks land on sign-in.
export default function Page() {
  redirect('/login');
}
