// OAuth consent screens sit outside the (app)/(auth) groups; keep them out of
// search like the rest of the signed-in surface.
export const metadata = { robots: { index: false, follow: false } };

export default function OAuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
