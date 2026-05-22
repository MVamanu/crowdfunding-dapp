import { useMemo, useState } from "react";
import "./SocialShare.css";

function buildShareText(title, description) {
  const cleanTitle = title || "Campanie FundChain";
  const cleanDescription = description ? ` - ${description.slice(0, 120)}` : "";
  return `Sustine ${cleanTitle}${cleanDescription}`;
}

export default function SocialShare({ title, description }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = useMemo(() => buildShareText(title, description), [title, description]);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  async function handleNativeShare() {
    setCopied(false);
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || "FundChain",
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    await handleCopy();
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copiaza link-ul campaniei:", shareUrl);
    }
  }

  const links = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    },
  ];

  return (
    <div className="share-card card">
      <div className="share-header">
        <div>
          <h3 className="share-title">Promoveaza campania</h3>
          <p className="share-desc">Distribuie link-ul catre sustinatori, donatori sau comunitatea ta.</p>
        </div>
        <button className="share-primary" type="button" onClick={handleNativeShare}>
          Share
        </button>
      </div>

      <div className="share-actions">
        {links.map(link => (
          <a key={link.label} className="share-link" href={link.href} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        ))}
        <button className="share-link" type="button" onClick={handleCopy}>
          {copied ? "Copiat" : "Copiaza"}
        </button>
      </div>
    </div>
  );
}
