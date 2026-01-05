import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export const CustomDropdown = ({
  label,
  value,
  options,
  onChange,
  updateActiveText,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (str: string) => void;
  updateActiveText: (updates: Object) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // We need to check if click is outside BOTH the trigger button AND the portal menu
      // Since portal is separate, we can check if it's in the button (dropdownRef)
      // If not, we should probably close.
      // However, detecting clicks inside the portal requires a ref on the portal content too.
      // SIMPLIFICATION: We can rely on the fact that clicking options calls setIsOpen(false).
      // But clicking "empty space" outside should close it.

      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        // This logic is tricky with portals because the menu is NOT inside dropdownRef anymore.
        // We'll handle menu-item clicks separately.
        // For outside clicks: if the target is NOT inside the portal menu...
        // We can use a specific ID or class for the portal menu to check.
        const menu = document.getElementById(`dropdown-menu-${label}`);
        if (menu && !menu.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
    };

    // Update position on scroll/resize
    const updatePos = () => {
      if (isOpen && dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + 5, // small gap
          left: rect.left,
          width: rect.width,
        });
      }
    };

    if (isOpen) {
      window.addEventListener("scroll", updatePos, true);
      window.addEventListener("resize", updatePos);
      // Initial calc
      updatePos();
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [isOpen, label]);

  const toggleOpen = () => {
    if (!isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 5,
        left: rect.left,
        width: rect.width,
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={toggleOpen}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50 flex items-center gap-2 min-w-[140px] justify-between"
        >
          <span className="truncate">
            {value} {label === "Size" ? "pt" : ""}
          </span>
          <ChevronDown
            size={14}
            className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen &&
          createPortal(
            <div
              id={`dropdown-menu-${label}`}
              className="fixed bg-white border border-gray-300 rounded-lg shadow-lg z-[9999] overflow-hidden max-h-60 overflow-y-auto"
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
              }}
            >
              {options.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    if (label === "Size") {
                      updateActiveText({ fontSize: Number(option) });
                    } else {
                      updateActiveText({ fontFamily: option });
                    }
                    onChange(option);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                    value === option ? "bg-gray-50 font-medium" : ""
                  }`}
                >
                  {option} {label === "Size" ? "pt" : ""}
                </button>
              ))}
            </div>,
            document.body
          )}
      </div>
    </div>
  );
};
