// Build "Discover" deep-links for a book — Goodreads quotes, Reddit threads,
// Substack posts, and related topic/philosophy resources. We link into each
// platform's search rather than scraping (no API keys, durable, ToS-friendly).

export interface SocialItem {
  label: string;
  url: string;
  hint?: string;
}

export interface SocialGroup {
  id: string;
  title: string;
  icon: string;
  items: SocialItem[];
}

function q(...parts: (string | null | undefined)[]): string {
  return encodeURIComponent(parts.filter(Boolean).join(" ").trim());
}

export function buildSocialLinks(
  title: string,
  author?: string | null,
): SocialGroup[] {
  const titleAuthor = q(title, author);
  const titleOnly = q(title);

  return [
    {
      id: "goodreads",
      title: "Goodreads",
      icon: "📗",
      items: [
        {
          label: "Quotes from this book",
          url: `https://www.goodreads.com/quotes/search?q=${titleOnly}&commit=Search`,
          hint: "Highlighted passages readers loved",
        },
        {
          label: "Find this book & reviews",
          url: `https://www.goodreads.com/search?q=${titleAuthor}`,
        },
      ],
    },
    {
      id: "reddit",
      title: "Reddit",
      icon: "👽",
      items: [
        {
          label: "Discussions everywhere",
          url: `https://www.reddit.com/search/?q=${titleAuthor}&sort=relevance`,
        },
        {
          label: "In r/books",
          url: `https://www.reddit.com/r/books/search/?q=${titleOnly}&restrict_sr=1&sort=relevance`,
        },
        {
          label: "In r/literature",
          url: `https://www.reddit.com/r/literature/search/?q=${titleOnly}&restrict_sr=1`,
        },
      ],
    },
    {
      id: "substack",
      title: "Substack",
      icon: "📰",
      items: [
        {
          label: "Essays & newsletters",
          url: `https://substack.com/search/${titleAuthor}?searching=all_posts`,
          hint: "Writers discussing the book",
        },
      ],
    },
    {
      id: "topics",
      title: "Topics & philosophy",
      icon: "🧠",
      items: [
        {
          label: "Wikipedia",
          url: `https://en.wikipedia.org/w/index.php?search=${titleAuthor}`,
        },
        {
          label: "Stanford Encyclopedia of Philosophy",
          url: `https://plato.stanford.edu/search/searcher.py?query=${titleOnly}`,
          hint: "For philosophical themes & thinkers",
        },
        {
          label: "Google Books",
          url: `https://www.google.com/search?tbm=bks&q=${titleAuthor}`,
        },
        {
          label: "Web search",
          url: `https://www.google.com/search?q=${q(title, author, "themes analysis")}`,
        },
      ],
    },
  ];
}
