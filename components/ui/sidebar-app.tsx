"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LogOut, LayoutDashboard, Map, MessageSquare, Bot, Upload, Building, Users, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  useSidebar,
} from "@/components/ui/sidebar";
import React, { useState } from "react";

type NavLink = { label: string; href: string; icon: React.ReactNode };

export function SidebarApp({
  pageName = "CRE Console",
  links = defaultLinks,
  onLogout,
}: {
  pageName?: string;
  links?: NavLink[];
  onLogout?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sidebar open={open} setOpen={setOpen}>
      {/* Brand: blue background + white text (propagates to Desktop & Mobile) */}
      <SidebarBody className="justify-between gap-6 bg-[#053771] text-white">
        {/* top */}
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          {open ? <LogoWithName name={pageName} /> : <LogoOnly />}
          <nav className="mt-8 flex flex-col gap-2">
            {links.map((link, i) => (
              <SidebarLink key={i} link={link as any} />
            ))}
          </nav>
        </div>

        {/* footer */}
        <SidebarFooter onLogout={onLogout} />
      </SidebarBody>
    </Sidebar>
  );
}

const defaultLinks: NavLink[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: <LayoutDashboard className="h-5 w-5 text-white" />,
  },
  {
    label: "AI Assistant",
    href: "/ai-assistant",
    icon: <Bot className="h-5 w-5 text-white" />,
  },
  {
    label: "Imports",
    href: "/imports",
    icon: <Upload className="h-5 w-5 text-white" />,
  },
  {
    label: "Properties",
    href: "/properties",
    icon: <Building className="h-5 w-5 text-white" />,
  },
  {
    label: "Leads",
    href: "/leads",
    icon: <Users className="h-5 w-5 text-white" />,
  },
  {
    label: "Opportunities",
    href: "/opportunities",
    icon: <FileText className="h-5 w-5 text-white" />,
  },
];

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
    // Collapsed state - show only logout icon
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

  // Expanded state - show full logout button with text
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