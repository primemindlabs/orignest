'use client';

import { useEffect, useState } from 'react';
import { IconCheck } from '@tabler/icons-react';

interface Realtor { id: string; first_name: string | null; last_name: string | null; email: string | null; unsubscribed_market_update?: boolean }

export function RealtorSendList({ selected, onSelectionChange }: { selected: Set<string>; onSelectionChange: (ids: Set<string>) => void }) {
  const [realtors, setRealtors] = useState<Realtor[]>([]);

  useEffect(() => {
    fetch('/api/realtors')
      .then((r) => r.json())
      .then((d) => {
        const active = ((d.realtors ?? []) as Realtor[]).filter((r) => r.email && !r.unsubscribed_market_update);
        setRealtors(active);
        onSelectionChange(new Set(active.map((r) => r.id))); // default: all eligible
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  }
  function toggleAll() {
    onSelectionChange(selected.size === realtors.length ? new Set() : new Set(realtors.map((r) => r.id)));
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">Send To ({realtors.length})</p>
        {realtors.length > 0 && (
          <button onClick={toggleAll} className="text-xs text-[#C9A95C] hover:underline">
            {selected.size === realtors.length ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>
      {realtors.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No realtors with an email on file. Add realtor emails in your network.</p>
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {realtors.map((r) => (
            <button key={r.id} onClick={() => toggle(r.id)} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 text-left">
              <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${selected.has(r.id) ? 'border-[#C9A95C] bg-[#C9A95C]' : 'border-gray-300'}`}>
                {selected.has(r.id) && <IconCheck size={12} className="text-white" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{r.first_name} {r.last_name}</p>
                <p className="text-xs text-gray-400 truncate">{r.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
