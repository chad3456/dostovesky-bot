import { LocalApp } from "@/components/local/local-app";

// Offline, this-device-only reader: books live in the browser (IndexedDB),
// nothing is uploaded to the server.
export default function LocalPage() {
  return <LocalApp />;
}
