import { useEffect, useState } from "react";
import "./BackToTop.css";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 420);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <button
      className={visible ? "back-to-top visible" : "back-to-top"}
      type="button"
      onClick={scrollTop}
      aria-label="Inapoi la inceput"
      title="Inapoi la inceput"
    >
      ↑
    </button>
  );
}
