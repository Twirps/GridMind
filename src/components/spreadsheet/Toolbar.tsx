import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CellData } from "./types";
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Undo, Redo, WrapText,
} from "lucide-react";

interface ToolbarProps {
  cellStyle: Partial<CellData>;
  onStyleChange: (style: Partial<CellData>) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

export function Toolbar({ cellStyle, onStyleChange, onUndo, onRedo, canUndo, canRedo }: ToolbarProps) {
  const toggle = (key: keyof CellData) => {
    onStyleChange({ [key]: !cellStyle[key] });
  };

  return (
    <div className="toolbar flex items-center gap-1 px-2 py-1 border-b border-border bg-toolbar select-none flex-wrap">
      {/* Undo/Redo */}
      <Button variant="toolbar" size="icon-sm" onClick={onUndo} disabled={!canUndo} title="Undo">
        <Undo className="h-3.5 w-3.5" />
      </Button>
      <Button variant="toolbar" size="icon-sm" onClick={onRedo} disabled={!canRedo} title="Redo">
        <Redo className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* Font size */}
      <Select
        value={String(cellStyle.fontSize ?? 12)}
        onValueChange={(v) => onStyleChange({ fontSize: Number(v) })}
      >
        <SelectTrigger className="h-6 w-14 text-xs border-border bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map((s) => (
            <SelectItem key={s} value={String(s)} className="text-xs">{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* Bold/Italic/Underline */}
      <Button variant={cellStyle.bold ? "toolbar-active" : "toolbar"} size="icon-sm" onClick={() => toggle("bold")} title="Bold (Ctrl+B)">
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button variant={cellStyle.italic ? "toolbar-active" : "toolbar"} size="icon-sm" onClick={() => toggle("italic")} title="Italic (Ctrl+I)">
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button variant={cellStyle.underline ? "toolbar-active" : "toolbar"} size="icon-sm" onClick={() => toggle("underline")} title="Underline (Ctrl+U)">
        <Underline className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* Alignment */}
      <Button variant={cellStyle.align === "left" || !cellStyle.align ? "toolbar-active" : "toolbar"} size="icon-sm" onClick={() => onStyleChange({ align: "left" })} title="Align Left">
        <AlignLeft className="h-3.5 w-3.5" />
      </Button>
      <Button variant={cellStyle.align === "center" ? "toolbar-active" : "toolbar"} size="icon-sm" onClick={() => onStyleChange({ align: "center" })} title="Align Center">
        <AlignCenter className="h-3.5 w-3.5" />
      </Button>
      <Button variant={cellStyle.align === "right" ? "toolbar-active" : "toolbar"} size="icon-sm" onClick={() => onStyleChange({ align: "right" })} title="Align Right">
        <AlignRight className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="h-5 mx-1" />

      {/* Colors */}
      <div className="flex items-center gap-1">
        <label className="flex flex-col items-center gap-0.5 cursor-pointer" title="Background Color">
          <span className="text-[9px] text-muted-foreground leading-none">BG</span>
          <input
            type="color"
            className="h-4 w-6 cursor-pointer rounded border-0 p-0"
            value={cellStyle.bgColor ?? "#ffffff"}
            onChange={(e) => onStyleChange({ bgColor: e.target.value })}
          />
        </label>
        <label className="flex flex-col items-center gap-0.5 cursor-pointer" title="Text Color">
          <span className="text-[9px] text-muted-foreground leading-none">TXT</span>
          <input
            type="color"
            className="h-4 w-6 cursor-pointer rounded border-0 p-0"
            value={cellStyle.textColor ?? "#000000"}
            onChange={(e) => onStyleChange({ textColor: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
