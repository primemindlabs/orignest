'use client';

import { format } from 'date-fns';

export interface InternalChatMessage {
  id: string;
  content: string;
  content_type: string;
  created_at: string;
  sender_name: string;
  sender_role: string;
  is_self: boolean;
}

export function ChatMessage({ message }: { message: InternalChatMessage }) {
  if (message.content_type === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-[11px] text-gray-400 bg-[#F4F2EF] rounded-full px-3 py-1">{message.content}</span>
      </div>
    );
  }

  const { is_self } = message;
  return (
    <div className={`flex ${is_self ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[80%]">
        {!is_self && (
          <p className="text-[11px] font-medium text-gray-500 mb-0.5 px-1">
            {message.sender_name}
            {message.sender_role && <span className="text-gray-300"> · {message.sender_role}</span>}
          </p>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
            is_self ? 'bg-[#C9A95C] text-white rounded-br-sm' : 'bg-[#F4F2EF] text-gray-800 rounded-bl-sm'
          }`}
        >
          {message.content}
        </div>
        <p className={`text-[10px] text-gray-400 mt-0.5 px-1 ${is_self ? 'text-right' : ''}`}>
          {format(new Date(message.created_at), 'MMM d, h:mm a')}
        </p>
      </div>
    </div>
  );
}
