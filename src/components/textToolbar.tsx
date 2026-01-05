/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import React, { type SetStateAction } from "react";
import { FaChevronDown, FaDownload, FaUndo, FaRedo } from "react-icons/fa";

import useDropdown from "../hooks/useDropdown";

const fontFamilies = [
  "Helvetica",
  "Times-Roman",
  "Courier",
  "Symbol",
  "ZapfDingbats",
];
const fontSizes = ["8", "10", "12", "14", "16", "18", "24", "36"];
function TextToolbar({
  selectedFont,
  setSelectedFont,
  selectedSize,
  setSelectedSize,
  updateTextStyle,
  ToggleTextStyle,
  handleDownload,
  downloadPdf,
  setSelectedColor,
  handleUndo,
  handleRedo,
}: {
  selectedFont: string;
  setSelectedFont: React.Dispatch<React.SetStateAction<string>>;
  selectedSize: string;
  setSelectedSize: React.Dispatch<React.SetStateAction<string>>;
  updateTextStyle: (object: object) => void;
  ToggleTextStyle: (style: string) => void;
  handleDownload: () => void;
  downloadPdf?: boolean;
  setSelectedColor: React.Dispatch<SetStateAction<string>>;
  handleUndo?: () => void;
  handleRedo?: () => void;
}) {
  const { dropdownRef, dropdowns, setDropdowns, closeDropDown } = useDropdown();
  return (
    <div className="w-full bg-white px-4 py-2 flex items-center justify-between border-b">
      <div className="w-full flex items-center gap-x-4">
        <div className="flex items-center gap-x-3">
          <span className="text-sm text-gray-700">Colour</span>
          <div
            className="w-5 h-5 cursor-pointer rounded-full border border-gray-300 hover:border-gray-500 bg-black"
            onClick={() => {
              updateTextStyle({ fill: "#000000" });
              setSelectedColor("#000000");
            }}
          />
          <div
            className="w-5 h-5 cursor-pointer rounded-full border border-gray-300 hover:border-gray-500 bg-orange-500"
            onClick={() => {
              updateTextStyle({ fill: "#ff9800" });
              setSelectedColor("#ff9800");
            }}
          />
          <div
            className="w-5 h-5 cursor-pointer rounded-full border border-gray-300 hover:border-gray-500 bg-blue-500"
            onClick={() => {
              updateTextStyle({ fill: "#2196f3" });
              setSelectedColor("#2196f3");
            }}
          />
        </div>

        {/* Font Family */}
        <div className="flex items-center relative gap-x-2">
          <span className="text-sm text-gray-700">Font</span>
          <div
            className="border flex items-center px-2 py-1 justify-between rounded cursor-pointer bg-white relative min-w-[100px]"
            onClick={() => setDropdowns({ ...dropdowns, fontFamilyBox: true })}
          >
            <span className="text-sm">{selectedFont}</span>
            <FaChevronDown size={10} />
            {dropdowns.fontFamilyBox && (
              <div
                className="absolute top-full left-0 w-full mt-1 z-10 bg-white border shadow rounded"
                ref={dropdownRef.fontFamilyBox}
              >
                {fontFamilies.map((font) => (
                  <div
                    className="px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm"
                    key={font}
                    onClick={() => {
                      updateTextStyle({ fontFamily: font });
                      setSelectedFont(font);
                      closeDropDown("fontFamilyBox");
                    }}
                  >
                    {font}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Font Size */}
        <div className="flex items-center relative gap-x-2">
          <span className="text-sm text-gray-700">Size</span>
          <div
            className="border flex items-center px-2 py-1 justify-between rounded cursor-pointer bg-white relative min-w-[70px]"
            onClick={() => setDropdowns({ ...dropdowns, fontSizeBox: true })}
          >
            <span className="text-sm">{selectedSize}</span>
            <FaChevronDown size={10} />
            {dropdowns.fontSizeBox && (
              <div
                className="absolute top-full left-0 w-full mt-1 z-10 bg-white border shadow rounded"
                ref={dropdownRef.fontSizeBox}
              >
                {fontSizes.map((size) => (
                  <div
                    className="px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm"
                    key={size}
                    onClick={() => {
                      updateTextStyle({ fontSize: Number(size) });
                      setSelectedSize(size);
                      closeDropDown("fontSizeBox");
                    }}
                  >
                    {size} pt
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-x-2">
          <button
            className="text-base font-bold w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded"
            onClick={() => ToggleTextStyle("fontWeight")}
            type="button"
          >
            B
          </button>
          <button
            className="italic font-normal text-base w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded"
            onClick={() => ToggleTextStyle("fontStyle")}
            type="button"
          >
            I
          </button>
          <button
            className="font-normal text-base underline w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded"
            onClick={() => ToggleTextStyle("underline")}
            type="button"
          >
            U
          </button>
        </div>

        {/* Undo/Redo */}
        <div className="flex items-center gap-x-2 ml-2">
          <button
            className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded"
            onClick={handleUndo}
            type="button"
            title="Undo"
          >
            <FaUndo size={14} />
          </button>
          <button
            className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded"
            onClick={handleRedo}
            type="button"
            title="Redo"
          >
            <FaRedo size={14} />
          </button>
        </div>
      </div>
      {downloadPdf && (
        <button
          className="px-4 py-2 font-medium w-fit  text-sm rounded-xl bg-gray-200 text-black"
          onClick={handleDownload}
          title="download pdf"
          type="button"
        >
          <FaDownload />
        </button>
      )}
    </div>
  );
}

export default TextToolbar;

//  "Helvetica, sans-serif",
//                         "Times, serif",
//                         "Courier, monospace",
