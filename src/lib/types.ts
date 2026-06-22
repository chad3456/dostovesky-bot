export interface BookSummary {
  id: string;
  title: string;
  author: string | null;
  cover: string | null;
  language: string | null;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  progress: number; // 0..1
  lastReadAt: string | null;
}

export interface BookDetail {
  id: string;
  title: string;
  author: string | null;
  language: string | null;
  description: string | null;
  cover: string | null;
  fileSize: number;
  fileName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Highlight {
  id: string;
  bookId: string;
  cfiRange: string;
  text: string;
  note: string | null;
  color: string;
  chapter: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Preferences {
  theme: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  margin: number;
  justify: boolean;
  flow: string;
}

export interface Progress {
  cfi: string | null;
  percentage: number;
  label: string | null;
  updatedAt: string;
}

export interface ShareLink {
  id: string;
  token: string;
  bookId: string;
  expiresAt: string | null;
  createdAt: string;
}
