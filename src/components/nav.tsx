"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavItem = { href: string; label: string; hint?: string };
export type NavGroup = { title: string; items: NavItem[] };

export function Nav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  return (
    <>
      <button className="btn-secondary btn-sm lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "Cerrar menú" : "Menú"}
      </button>
      <nav className={`${open ? "block" : "hidden"} mt-3 lg:mt-0 lg:block`} onClick={() => setOpen(false)}>
        {groups.map((g) => (
          <div key={g.title} className="mb-5">
            <div className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-brand-100/70 uppercase">{g.title}</div>
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded-lg px-3 py-2 text-sm transition ${
                      isActive(item.href) ? "bg-white/15 font-medium text-white" : "text-brand-100 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.label}
                    {item.hint && <span className="block text-[11px] font-normal text-brand-100/60">{item.hint}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
