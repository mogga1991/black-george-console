"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LogOut, Map, Building, TrendingUp, DollarSign, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  useSidebar,
} from "@/components/ui/sidebar";
import React, { useState } from "react";

type NavLink = { label: string; href: string; icon: React.ReactNode };

const MVP_LINKS: NavLink[] = [
  {
    label: "Leasing Scout",
    href: "/leasing-scout",
    icon: <User className="h-5 w-5 text-white" />,
  },
  {
    label: "Solicitation Map",
    href: "/opportunities",
    icon: <Map className="h-5 w-5 text-white" />,
  },
  {
    label: "Properties",
    href: "/properties",
    icon: <Building className="h-5 w-5 text-white" />,
  },
  {
    label: "Market Intel",
    href: "/market-intel",
    icon: <TrendingUp className="h-5 w-5 text-white" />,
  },
  {
    label: "Financing Support",
    href: "/financing-support",
    icon: <DollarSign className="h-5 w-5 text-white" />,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: <Settings className="h-5 w-5 text-white" />,
  },
];

export function SidebarApp({
  pageName = "CRE Console",
  onLogout,
}: {
  pageName?: string;
  onLogout?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sidebar open={open} setOpen={setOpen}>
      <SidebarBody className="justify-between gap-6 bg-[#41205C] text-white">
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          {open ? <LogoWithName name={pageName} /> : <LogoOnly />}
          <nav className="mt-8 flex flex-col gap-2">
            {MVP_LINKS.map((link, i) => (
              <SidebarLink key={i} link={link} />
            ))}
          </nav>
        </div>
        <SidebarFooter onLogout={onLogout} />
      </SidebarBody>
    </Sidebar>
  );
}

export function LogoWithName({ name }: { name: string }) {
  return (
    <Link
      href="/"
      className="font-normal flex space-x-2 items-center text-sm py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-medium text-white whitespace-pre">
        {name}
      </motion.span>
    </Link>
  );
}

export function LogoOnly() {
  return (
    <Link
      href="/"
      className="font-normal flex space-x-2 items-center text-sm py-1 relative z-20"
      aria-label="Home"
    >
      <div className="h-5 w-6 bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
    </Link>
  );
}

function SidebarFooter({ onLogout }: { onLogout?: () => void }) {
  const { open } = useSidebar();

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={onLogout}
          className={cn(
            "w-full flex items-center justify-center rounded-lg border p-2 text-sm",
            "border-white/20 text-white hover:bg-white/10"
          )}
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onLogout}
        className={cn(
          "w-full inline-flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
          "border-white/20 text-white hover:bg-white/10"
        )}
      >
        <span>Logout</span>
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}