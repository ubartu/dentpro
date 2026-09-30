"use client";

import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";

const links = [
  { href: "#nasil-calisir", label: "Nasıl çalışır" },
  { href: "#deger", label: "Değer" },
  { href: "#yatirimci", label: "Yatırımcılar" },
  { href: "#guven", label: "Güven" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="container nav-inner">
        <a className="brand" href="#ust" aria-label="Dentrivo ana sayfa" onClick={() => setOpen(false)}>
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>DENTRIVO</span>
        </a>
        <nav className={`nav-links ${open ? "open" : ""}`} aria-label="Ana menü">
          {links.map((link) => <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</a>)}
          <a className="nav-mobile-cta" href="#iletisim" onClick={() => setOpen(false)}>İletişim <ArrowUpRight size={16} /></a>
        </nav>
        <a className="nav-cta" href="#iletisim">İletişim <ArrowUpRight size={15} /></a>
        <button className="menu-toggle" type="button" aria-label={open ? "Menüyü kapat" : "Menüyü aç"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  );
}
