// Instagram Portfolio Loader
// Kur website publikohet në Firebase Hosting + Functions,
// ky file lexon postimet nga /api/instagram-feed dhe i vendos te "Punimet tona".

const FEED_ENDPOINT = "/api/instagram-feed";

function shortCaption(text = "") {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (!clean) return "Instagram Post";
  return clean.length > 42 ? clean.slice(0, 42) + "..." : clean;
}

function setStatus(message) {
  const status = document.getElementById("instagramFeedStatus");
  if (status) status.textContent = message;
}

async function loadInstagramPortfolio() {
  const grid = document.getElementById("instagramPortfolioGrid");
  if (!grid) return;

  const cards = [...grid.querySelectorAll(".portfolio-card")];
  if (!cards.length) return;

  try {
    const response = await fetch(FEED_ENDPOINT, { cache: "no-store" });
    if (!response.ok) throw new Error("Instagram endpoint nuk u përgjigj.");

    const payload = await response.json();
    const posts = Array.isArray(payload.data) ? payload.data : [];

    const usablePosts = posts
      .filter((post) => post.media_url || post.thumbnail_url)
      .slice(0, cards.length);

    if (!usablePosts.length) throw new Error("Nuk u gjetën postime me foto.");

    usablePosts.forEach((post, index) => {
      const card = cards[index];
      const img = card.querySelector("img");
      const title = card.querySelector(".portfolio-overlay h5");
      const imageUrl = post.media_type === "VIDEO"
        ? (post.thumbnail_url || post.media_url)
        : (post.media_url || post.thumbnail_url);

      if (img && imageUrl) {
        img.src = imageUrl;
        img.alt = shortCaption(post.caption || "Punim nga Instagram");
        img.loading = "lazy";
      }

      if (title) title.textContent = shortCaption(post.caption);

      if (post.permalink) {
        card.setAttribute("role", "link");
        card.setAttribute("tabindex", "0");
        card.classList.add("instagram-linked-card");
        card.onclick = () => window.open(post.permalink, "_blank", "noopener,noreferrer");
        card.onkeydown = (event) => {
          if (event.key === "Enter") window.open(post.permalink, "_blank", "noopener,noreferrer");
        };
      }
    });

    setStatus("Fotot u morën nga postimet e Instagram-it.");
  } catch (error) {
    setStatus("Fotot lokale po shfaqen. Për auto-feed duhet Firebase Function + Instagram token.");
  }
}

loadInstagramPortfolio();
