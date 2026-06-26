import { LocalApp } from "@/components/local/local-app";

// Home is a fully client-side reader: upload an EPUB and read it — no account
// or database required. (Sign-in and the synced library live under /library.)
export default function HomePage() {
  return <LocalApp />;
}
