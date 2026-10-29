"use client";

import React, { useState, useRef, useEffect } from "react";
import { BookOpen, X } from "lucide-react";
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
}: MentionTextareaProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      {/* Attached Program Mention Chip */}
      {selectedProgram && (
        <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-md bg-teal-950/80 border border-teal-500/50 text-teal-300 text-xs font-medium shadow-sm animate-in fade-in">
          <BookOpen className="w-3.5 h-3.5 text-teal-400" />
          <span>Referencing: &quot;{selectedProgram.title}&quot;</span>
          <button
            type="button"
            onClick={() => onSelectProgram(null)}
            className="ml-1 p-0.5 rounded hover:bg-teal-900/60 text-teal-400 hover:text-teal-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        rows={rows}
        className="resize-none"
      />

      {/* Autocomplete Dropdown */}
      {showDropdown && filteredPrograms.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl z-30">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
            Mention Program
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
