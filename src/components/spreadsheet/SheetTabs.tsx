import { useState } from "react";
import { Plus, X } from "lucide-react";
import { SheetData } from "./types";

interface SheetTabsProps {
  sheets: SheetData[];
  activeSheetId: string;
  onSelectSheet: (id: string) => void;
  onAddSheet: () => void;
  onRenameSheet: (id: string, name: string) => void;
  onDeleteSheet: (id: string) => void;
}

export function SheetTabs({ sheets, activeSheetId, onSelectSheet, onAddSheet, onRenameSheet, onDeleteSheet }: SheetTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  return (
    <div className="flex items-end border-t border-border bg-muted h-8 select-none overflow-x-auto flex-shrink-0">
      {sheets.map((sheet) => (
        <div
          key={sheet.id}
          className={`flex items-center gap-1 px-3 h-full border-r border-border cursor-pointer text-xs font-medium transition-colors flex-shrink-0 ${
            sheet.id === activeSheetId
              ? "bg-background text-foreground border-t-2 border-t-primary"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
          onClick={() => onSelectSheet(sheet.id)}
          onDoubleClick={() => { setEditingId(sheet.id); setEditName(sheet.name); }}
        >
          {editingId === sheet.id ? (
            <input
              autoFocus
              className="w-20 text-xs bg-transparent outline outline-1 outline-primary rounded px-1"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => { onRenameSheet(sheet.id, editName || sheet.name); setEditingId(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { onRenameSheet(sheet.id, editName || sheet.name); setEditingId(null); }
                else if (e.key === "Escape") setEditingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span>{sheet.name}</span>
          )}
          {sheets.length > 1 && (
            <button
              className="opacity-0 group-hover:opacity-100 hover:opacity-100 ml-1 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onDeleteSheet(sheet.id); }}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      ))}
      <button
        className="flex items-center justify-center px-2 h-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        onClick={onAddSheet}
        title="Add Sheet"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
