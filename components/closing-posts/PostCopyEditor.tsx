'use client';

interface PostCopyEditorProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function PostCopyEditor({ value, onChange, disabled }: PostCopyEditorProps) {
  const charCount = value.length;
  const isOver = charCount > 300;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Post Copy</label>
        <span className={`text-xs ${isOver ? 'text-red-500' : 'text-gray-400'}`}>{charCount} / 300</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={6}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 resize-none disabled:bg-gray-50 disabled:text-gray-500"
      />
      <p className="text-xs text-gray-400 mt-1">Edit the copy above. The compliance checker runs automatically as you type.</p>
    </div>
  );
}
