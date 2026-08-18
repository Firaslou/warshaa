import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  accept: string;
  onFiles: (files: File[]) => void | Promise<void>;
  disabled?: boolean;
  multiple?: boolean;
  label?: string;
  hint?: string;
  compact?: boolean;
  className?: string;
};

export function SecureFileDropzone({
  accept,
  onFiles,
  disabled = false,
  multiple = false,
  label = "Déposez un fichier ici ou cliquez pour choisir",
  hint,
  compact = false,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const deliver = (list: FileList | null) => {
    if (disabled || !list?.length) return;
    const files = Array.from(list);
    void onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-center transition",
        compact ? "min-h-20 p-3" : "min-h-28 p-5",
        dragging && "border-primary bg-primary/5",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragOver={(event) => { event.preventDefault(); if (!disabled) event.dataTransfer.dropEffect = "copy"; }}
      onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        deliver(event.dataTransfer.files);
      }}
    >
      <UploadCloud className="mb-2 h-5 w-5 text-primary" />
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="mt-1 text-xs text-muted-foreground">{hint}</span>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          deliver(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}

