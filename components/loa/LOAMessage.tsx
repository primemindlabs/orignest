export interface LOAMessageData {
  role: 'user' | 'loa';
  content: string;
  sources?: string[];
  timestamp: Date;
}

export function LOAMessage({ message }: { message: LOAMessageData }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-gray-900 px-3 py-2 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }

  // Split out the Source line from the body for styled rendering.
  const sourcePattern = /\n?Source:\s*(.+)$/im;
  const sourceMatch = message.content.match(sourcePattern);
  const body = message.content.replace(sourcePattern, '').trim();
  const sourceText = sourceMatch?.[1];

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-1">
        <div className="rounded-2xl rounded-bl-sm bg-gray-50 border border-gray-100 px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
          {body}
        </div>
        {sourceText && <p className="text-xs text-gray-400 px-1">Source: {sourceText}</p>}
      </div>
    </div>
  );
}
