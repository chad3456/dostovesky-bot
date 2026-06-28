import { PublicLibrary } from "@/components/public/public-library";

// Home is the shared public library: anyone with the URL sees every uploaded
// EPUB and can add more. Reading position + highlights are kept per-device.
// (Private synced library lives under /library; offline-only reader at /local.)
export default function HomePage() {
  return <PublicLibrary />;
}
