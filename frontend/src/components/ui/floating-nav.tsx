"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Home, Search, Bell, User, Settings, Bookmark } from "lucide-react";

export interface NavItem {
  id: number;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

interface FloatingNavProps {
  items?: NavItem[];
  activeIndex?: number;
  onSelect?: (index: number) => void;
}

const FloatingNav: React.FC<FloatingNavProps> = ({
  items: customItems,
  activeIndex: customActiveIndex,
  onSelect,
}) => {
  const [activeInternal, setActiveInternal] = useState(0);
  const active = customActiveIndex !== undefined ? customActiveIndex : activeInternal;

  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const defaultItems: NavItem[] = [
    { id: 0, icon: <Home size={22} />, label: "Home" },
    { id: 1, icon: <Search size={22} />, label: "Search" },
    { id: 2, icon: <Bell size={22} />, label: "Alerts" },
    { id: 3, icon: <User size={22} />, label: "Profile" },
    { id: 4, icon: <Bookmark size={22} />, label: "Saved" },
    { id: 5, icon: <User size={22} />, label: "Profile" },
    { id: 6, icon: <Settings size={22} />, label: "Settings" },
  ];

  const items = customItems || defaultItems;

  const handleSelect = (index: number) => {
    if (customActiveIndex === undefined) {
      setActiveInternal(index);
    }
    if (onSelect) {
      onSelect(index);
    }
    if (items[index]?.onClick) {
      items[index].onClick!();
    }
  };

  // Update indicator position when active changes or resize
  useEffect(() => {
    const updateIndicator = () => {
      if (btnRefs.current[active] && containerRef.current) {
        const btn = btnRefs.current[active];
        const container = containerRef.current;
        if (!btn) return;
        const btnRect = btn.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        setIndicatorStyle({
          width: btnRect.width,
          left: btnRect.left - containerRect.left,
        });
      }
    };

    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [active, items.length]);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-md px-2">
      <div
        ref={containerRef}
        className="relative flex items-center justify-between bg-bg-surface/90 dark:bg-bg-surface/90 backdrop-blur-2xl shadow-2xl rounded-full px-2 py-1.5 border border-border-medium/80"
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(el) => {
              btnRefs.current[index] = el;
            }}
            onClick={() => handleSelect(index)}
            className={`relative flex flex-col items-center justify-center flex-1 px-3 py-2 text-xs font-medium transition-colors cursor-pointer rounded-full ${
              active === index
                ? "text-primary-coral dark:text-primary-gold"
                : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            <div className="z-10">{item.icon}</div>
            {/* hide labels on small screens */}
            <span className="text-[10px] mt-0.5 hidden sm:block font-medium truncate max-w-[60px]">{item.label}</span>
          </button>
        ))}

        {/* Sliding Active Indicator */}
        {indicatorStyle.width > 0 && (
          <motion.div
            animate={indicatorStyle}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute top-1 bottom-1 rounded-full bg-primary-coral/15 dark:bg-primary-gold/20 border border-primary-coral/30 dark:border-primary-gold/30 pointer-events-none"
          />
        )}
      </div>
    </div>
  );
};

export default FloatingNav;
