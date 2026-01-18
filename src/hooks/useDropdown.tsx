/* eslint-disable no-restricted-syntax */
import { useEffect, useRef, useState } from "react";

function useDropdown() {
  const dropdownRef = {
    stampbox: useRef<HTMLDivElement>(null),
    fontFamilyBox: useRef<HTMLDivElement>(null),
    fontSizeBox: useRef<HTMLDivElement>(null),
  };

  const [dropdowns, setDropdowns] = useState({
    stampbox: false,
    fontFamilyBox: false,
    fontSizeBox: false,
  });

  useEffect(() => {
    const handleClickOutSide = (event: MouseEvent) => {
      let outSide = true;

      const refs = Object.values(dropdownRef);
      for (const ref of refs) {
        if (ref.current && ref.current.contains(event.target as Node)) {
          outSide = false;
        }
      }

      if (outSide) {
        setDropdowns({
          stampbox: false,
          fontFamilyBox: false,
          fontSizeBox: false,
        });
      }
    };

    document.addEventListener("mousedown", handleClickOutSide);
    return () => document.removeEventListener("mousedown", handleClickOutSide);
  }, []);

  const closeDropDown = (dropdown: keyof typeof dropdowns) => {
    setDropdowns((previous) => ({ ...previous, [dropdown]: false }));
  };
  return { dropdownRef, dropdowns, setDropdowns, closeDropDown };
}

export default useDropdown;
