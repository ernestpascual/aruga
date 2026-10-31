"use client";

import React, { useState, useRef, useEffect } from "react";
import { BookOpen, X, ChevronDown, Check } from "lucide-react";
import { Textarea } from "./textarea";

export interface ProgramMentionOption {
  id: string;
  title: string;
  status: "assigned" | "archived";
}

interface MentionTextareaProps {
  value: string;
  onChange: (val: string) => void;
  selectedProgram: ProgramMentionOption | null;
  onSelectProgram: (prog: ProgramMentionOption | null) => void;
  availablePrograms: ProgramMentionOption[];
  placeholder?: string;
  rows?: number;
  className?: string;
  showDirectPickerButton?: boolean;
}

export function MentionTextarea({
  value,
  onChange,
  selectedProgram,
  onSelectProgram,
  availablePrograms,
  placeholder = "Type a message... (Type @ to mention an assigned home program)",
  rows = 3,
  className = "",
  showDirectPickerButton = true,
}: MentionTextareaProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPickerMenu, setShowPickerMenu] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPickerMenu(false);
      }
    };
    if (showPickerMenu) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showPickerMenu]);

  // Detect when user types @
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    onChange(text);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = text.slice(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1 && lastAtIndex === cursor - 1) {
      setShowDropdown(true);
      setSearchFilter("");
    } else if (lastAtIndex !== -1 && lastAtIndex < cursor) {
      const query = textBeforeCursor.slice(lastAtIndex + 1);
      if (!query.includes(" ")) {
        setShowDropdown(true);
        setSearchFilter(query.toLowerCase());
      } else {
        setShowDropdown(false);
      }
    } else {
      setShowDropdown(false);
    }
  };

  const handleSelect = (prog: ProgramMentionOption) => {
    onSelectProgram(prog);
    setShowDropdown(false);
    setShowPickerMenu(false);

    // Remove the trailing @ or partial search from text
    if (textareaRef.current) {
      const cursor = textareaRef.current.selectionStart;
      const textBeforeCursor = value.slice(0, cursor);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");
      if (lastAtIndex !== -1) {
        const newText = value.slice(0, lastAtIndex) + value.slice(cursor);
        onChange(newText);
      }
      textareaRef.current.focus();
    }
  };

  const filteredPrograms = availablePrograms.filter(
    (p) =>
      p.status !== ("draft" as unknown) &&
      p.title.toLowerCase().includes(searchFilter)
  );

  return (
    <div className={`relative flex flex-col gap-2 ${className}`}>
      {/* Top Toolbar: Attached Chip & Reference Program Button */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {selectedProgram ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-950/90 border border-teal-500/50 text-teal-300 text-xs font-medium shadow-sm animate-in fade-in">
            <BookOpen className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="truncate max-w-[280px]">
              Referencing: <span className="underline font-semibold">&quot;{selectedProgram.title}&quot;</span>
            </span>
            <button
              type="button"
              onClick={() => onSelectProgram(null)}
              title="Remove reference"
              className="ml-1 p-0.5 rounded hover:bg-teal-900/60 text-teal-400 hover:text-teal-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-zinc-500">
            Reference a home program below or type <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">@</kbd>
          </span>
        )}

        {/* Explicit Reference Home Program Picker Button */}
        {showDirectPickerButton && (
          <div className="relative ml-auto" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setShowPickerMenu(!showPickerMenu)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-900/90 hover:bg-zinc-800 text-[11px] font-medium text-teal-400 hover:text-teal-300 transition-colors shadow-sm"
            >
              <BookOpen className="w-3.5 h-3.5 text-teal-400" />
              <span>{selectedProgram ? "Change Program" : "Reference Home Program"}</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>

            {/* Direct Picker Dropdown Menu */}
            {showPickerMenu && (
              <div className="absolute right-0 bottom-full mb-1 w-72 rounded-xl border border-zinc-700 bg-zinc-900 p-1.5 shadow-2xl z-40 animate-in fade-in zoom-in-95">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 flex items-center justify-between">
                  <span>Available Client Home Programs</span>
                  <span className="text-[10px] text-zinc-500">{availablePrograms.length}</span>
                </div>

                <div className="max-h-48 overflow-y-auto py-1 space-y-0.5">
                  {availablePrograms.length === 0 ? (
                    <div className="p-3 text-center text-xs text-zinc-500">
                      No active home programs assigned to this client yet.
                    </div>
                  ) : (
                    availablePrograms.map((prog) => {
                      const isSelected = selectedProgram?.id === prog.id;
                      return (
                        <button
                          key={prog.id}
                          type="button"
                          onClick={() => handleSelect(prog)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 ${
                            isSelected
                              ? "bg-teal-950/80 border border-teal-500/40 text-teal-200"
                              : "text-zinc-200 hover:bg-zinc-800/80 hover:text-teal-300"
                          }`}
                        >
                          <span className="truncate font-medium">{prog.title}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        rows={rows}
        className="resize-none border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-teal-500"
      />

      {/* Autocomplete Dropdown when typing @ */}
      {showDropdown && filteredPrograms.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl z-30">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 flex items-center justify-between">
            <span>Mention Home Program</span>
            <span className="text-[10px] text-teal-400">Select to attach</span>
          </div>
          <div className="max-h-40 overflow-y-auto py-1">
            {filteredPrograms.map((prog) => (
              <button
                key={prog.id}
                type="button"
                onClick={() => handleSelect(prog)}
                className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-zinc-200 hover:bg-teal-950 hover:text-teal-200 transition-colors flex items-center justify-between"
              >
                <span className="truncate font-medium">{prog.title}</span>
                <span className="text-[10px] text-zinc-500 uppercase ml-2">
                  {prog.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
