import { useMemo, useState } from "react";
import "./SocialShare.css";

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 16.1c-1.1 0-2.1.5-2.7 1.3L8.9 13.7c.1-.3.1-.5.1-.8s0-.5-.1-.8l6.3-3.7A3.3 3.3 0 1 0 14 6c0 .3 0 .5.1.8L7.8 10.5a3.3 3.3 0 1 0 0 4.9l6.4 3.8c-.1.2-.1.5-.1.8a3.3 3.3 0 1 0 3.9-3.9Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.1 4.1a7.8 7.8 0 0 0-6.7 11.8l-.9 3.6 3.7-1a7.8 7.8 0 1 0 3.9-14.4Zm0 1.7a6.1 6.1 0 0 1 5.2 9.3 6 6 0 0 1-7.7 2.2l-.3-.2-2.2.6.6-2.1-.2-.3a6.1 6.1 0 0 1 4.6-9.5Zm-2.4 3.1c-.1 0-.3 0-.4.2-.3.3-.8.8-.8 1.9 0 1.1.8 2.1.9 2.2.1.2 1.6 2.6 4 3.5 2 .8 2.4.5 2.8.5.4-.1 1.3-.6 1.5-1.1.2-.5.2-1 .1-1.1-.1-.1-.2-.2-.5-.3l-1.5-.7c-.2-.1-.4-.1-.6.2l-.6.8c-.1.2-.3.2-.5.1-.3-.1-1-.4-1.8-1.1-.7-.6-1.1-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.5c.1-.1.1-.2.2-.4.1-.1 0-.3 0-.4l-.7-1.5c-.2-.4-.3-.4-.5-.4h-.8Z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 7a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-1v-2h1a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-5a1 1 0 0 0-1 1v1H9V7Zm-5 5a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5Zm3-1a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H7Z" />
    </svg>
  );
}

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
      className: "whatsapp",
      icon: <WhatsAppIcon />,
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    },
    {
      label: "Facebook",
      className: "facebook",
      icon: <span aria-hidden="true">f</span>,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      label: "LinkedIn",
      className: "linkedin",
      icon: <span aria-hidden="true">in</span>,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      label: "X",
      className: "x",
      icon: <span aria-hidden="true">X</span>,
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
          <ShareIcon />
          Share
        </button>
      </div>

      <div className="share-actions">
        {links.map(link => (
          <a
            key={link.label}
            className={`share-link ${link.className}`}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            aria-label={`Distribuie pe ${link.label}`}
            title={`Distribuie pe ${link.label}`}
          >
            {link.icon}
            <span className="share-link-label">{link.label}</span>
          </a>
        ))}
        <button
          className={copied ? "share-link copy copied" : "share-link copy"}
          type="button"
          onClick={handleCopy}
          aria-label="Copiaza link-ul campaniei"
          title="Copiaza link-ul campaniei"
        >
          <CopyIcon />
          <span className="share-link-label">{copied ? "Copiat" : "Copiaza"}</span>
        </button>
      </div>
    </div>
  );
}
