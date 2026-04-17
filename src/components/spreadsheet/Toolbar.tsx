import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CellData, WrapMode } from "./types";
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Undo, Redo, WrapText, MoveHorizontal, Scissors, Group,
} from "lucide-react";

interface ToolbarProps {
  cellStyle: Partial<CellData>;
  onStyleChange: (style: Partial<CellData>) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onGroupRows?: () => void;
  onGroupCols?: () => void;
  onUngroupRows?: () => void;
  onUngroupCols?: () => void;
  hasRangeSelection?: boolean;
}

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

export function Toolbar({
  cellStyle, onStyleChange, onUndo, onRedo, canUndo, canRedo,
  onGroupRows, onGroupCols, onUngroupRows, onUngroupCols, hasRangeSelection,
}: ToolbarProps) {
  const toggle = (key: keyof CellData) => {
    onStyleChange({ [key]: !cellStyle[key] });
  };

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-background select-none flex-wrap">
      {/* Undo/Redo */}
      <Button variant="toolbar" size="icon-sm" onClick={onUndo} disabled={!canUndo} title="Undo">
        <Undo className="h-3.5 w-3.5" />
      </Button>
      <Button variant="toolbar" size="icon-sm" onClick={onRedo} disabled={!canRedo} title="Redo">
        <Redo className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="h-5 mx-1.5" />

      {/* Font size */}
      <Select
        value={String(cellStyle.fontSize ?? 12)}
        onValueChange={(v) => onStyleChange({ fontSize: Number(v) })}
      >
        <SelectTrigger className="h-7 w-14 text-xs border-border bg-background rounded">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map((s) => (
            <SelectItem key={s} value={String(s)} className="text-xs">{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="h-5 mx-1.5" />

      {/* Bold/Italic/Underline */}
      <div className="flex items-center gap-0.5">
        <Button variant={cellStyle.bold ? "toolbar-active" : "toolbar"} size="icon-sm" onClick={() => toggle("bold")} title="Bold (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button variant={cellStyle.italic ? "toolbar-active" : "toolbar"} size="icon-sm" onClick={() => toggle("italic")} title="Italic (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button variant={cellStyle.underline ? "toolbar-active" : "toolbar"} size="icon-sm" onClick={() => toggle("underline")} title="Underline (Ctrl+U)">
          <Underline className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-5 mx-1.5" />

      {/* Wrap mode: Overflow / Wrap / Clip */}
      <div className="flex items-center gap-0.5">
        {(() => {
          const current: WrapMode = cellStyle.wrapMode ?? "overflow";
          const setMode = (m: WrapMode) => onStyleChange({ wrapMode: m });
          return (
            <>
              <Button variant={current === "overflow" ? "toolbar-active" : "toolbar"} size="icon-sm" onClick={() => setMode("overflow")} title="Overflow (spill into empty cells)">
                <MoveHorizontal className="h-3.5 w-3.5" />
              </Button>
              <Button variant={current === "wrap" ? "toolbar-active" : "toolbar"} size="icon-sm" onClick={() => setMode("wrap")} title="Wrap text">
                <WrapText className="h-3.5 w-3.5" />
              </Button>
              <Button variant={current === "clip" ? "toolbar-active" : "toolbar"} size="icon-sm" onClick={() => setMode("clip")} title="Clip text">
                <Scissors className="h-3.5 w-3.5" />
              </Button>
            </>
          );
        })()}
      </div>

      <Separator orientation="vertical" className="h-5 mx-1.5" />

      {/* Alignment */}
      <div className="flex items-center gap-0.5">
        <Button variant={cellStyle.align === "left" || !cellStyle.align ? "toolbar-active" : "toolbar"} size="icon-sm" onClick={() => onStyleChange({ align: "left" })} title="Align Left">
          <AlignLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant={cellStyle.align === "center" ? "toolbar-active" : "toolbar"} size="icon-sm" onClick={() => onStyleChange({ align: "center" })} title="Align Center">
          <AlignCenter className="h-3.5 w-3.5" />
        </Button>
        <Button variant={cellStyle.align === "right" ? "toolbar-active" : "toolbar"} size="icon-sm" onClick={() => onStyleChange({ align: "right" })} title="Align Right">
          <AlignRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Separator orientation="vertical" className="h-5 mx-1.5" />

      {/* Colors */}
      <div className="flex items-center gap-1.5">
        <label className="flex flex-col items-center gap-0.5 cursor-pointer" title="Background Color">
          <span className="text-[9px] text-muted-foreground leading-none font-medium">BG</span>
          <input
            type="color"
            className="h-5 w-7 cursor-pointer rounded border border-border p-0"
            value={cellStyle.bgColor ?? "#ffffff"}
            onChange={(e) => onStyleChange({ bgColor: e.target.value })}
          />
        </label>
        <label className="flex flex-col items-center gap-0.5 cursor-pointer" title="Text Color">
          <span className="text-[9px] text-muted-foreground leading-none font-medium">TXT</span>
          <input
            type="color"
            className="h-5 w-7 cursor-pointer rounded border border-border p-0"
            value={cellStyle.textColor ?? "#000000"}
            onChange={(e) => onStyleChange({ textColor: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
