import { useRef, useEffect } from "react";
import { CellAddress, cellLabel, CellData } from "./types";

interface FormulaBarProps {
  selectedCell: CellAddress | null;
  cellData: CellData | undefined;
  onCommit: (value: string) => void;
}

export function FormulaBar({ selectedCell, cellData, onCommit }: FormulaBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRef = selectedCell ? cellLabel(selectedCell.row, selectedCell.col) : "";
  const displayValue = cellData?.formula ?? cellData?.value ?? "";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onCommit(e.currentTarget.value);
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      if (inputRef.current) inputRef.current.value = displayValue;
      e.currentTarget.blur();
    }
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = displayValue;
    }
  }, [displayValue, selectedCell]);

  return (
    <div className="flex items-center border-b border-border bg-background h-7 flex-shrink-0">
      {/* Cell reference box */}
      <div className="flex items-center justify-center border-r border-border px-2 h-full min-w-[60px] text-xs font-mono font-medium text-muted-foreground bg-muted select-none">
        {cellRef}
      </div>
      {/* fx indicator */}
      <div className="flex items-center justify-center px-2 h-full border-r border-border text-xs italic text-muted-foreground select-none">
        fx
      </div>
      {/* Formula input */}
      <input
        ref={inputRef}
        className="flex-1 h-full px-2 text-xs font-mono outline-none bg-background text-foreground"
        defaultValue={displayValue}
        onKeyDown={handleKeyDown}
        onBlur={(e) => onCommit(e.target.value)}
        placeholder={selectedCell ? "Enter value or formula (e.g. =SUM(A1:A5))" : ""}
        readOnly={!selectedCell}
      />
    </div>
  );
}
