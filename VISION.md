We want to be able to read articles from hackernews on our kobo elipsa 2e. It has an experimental web browser mode but with very minimal functionality within it. It has basic css and javascript support, but nothing too crazy. Our goal for this project is:

- Via configuration, scrape from hackernews the over?points=X (default to 300) stories. Pull the comments for them all and scrape the article linked in the URL directly.
- New, serve the webpage for this app very similar to the hackernews frontpage showing those top stories, but sort them strictly by most recent first (not the weird weighting the front page on hackernews automatically does). This page has 3 nice big buttons for comments (going to a page seeing the comments in a tree), scraped article (going to a page with the scraped article contents, essentially just title + body / images),  and direct link (a fallback link the user can use to visit the real live article itself, but the kobo may struggle to render it).
- the comments page for an article should look similar to the one on hackernews, but once again be optimized for rendering on a giant e-reader device with big tap boxes for expanding and shrinking comment trees.

Remember this is rendering on an e-reader, the websites should be pretty simple / plaintext-y in their formatting to try and have them rendering extremely fast.

For our scrape, it can be configurable via .env, so you can configure:
- the points over value
- how frequently the scrape should occur (default to hourly)

The scrape should only really process the links on the first page returned by over?points=x, and for each of those articles it should completely re-cache the comments for them.
