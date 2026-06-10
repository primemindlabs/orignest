'use client';

import { useEffect, useState } from 'react';

interface GreetingBarProps {
  name: string;
  alertCount: number;
  tasksDueToday: number;
}

/**
 * Greeting reflects the LO's LOCAL time, so it's computed on the client after mount
 * (server render would use the server clock). Falls back to a neutral greeting pre-mount.
 */
export function GreetingBar({ name, alertCount, tasksDueToday }: GreetingBarProps) {
  const [greeting, setGreeting] = useState('Welcome back');

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }, []);

  return (
    <div
      className="flex-shrink-0"
      style={{
        padding: '9px 13px',
        background: '#ffffff',
        borderBottom: '0.5px solid rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 500, color: '#1D1D1F' }}>
        {greeting}, {name}
      </div>
      <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 2 }}>
        {alertCount > 0 && (
          <>
            {alertCount} loan{alertCount !== 1 ? 's' : ''} need attention
          </>
        )}
        {alertCount > 0 && tasksDueToday > 0 && ' · '}
        {tasksDueToday > 0 && (
          <>
            {tasksDueToday} task{tasksDueToday !== 1 ? 's' : ''} due today
          </>
        )}
        {alertCount === 0 && tasksDueToday === 0 && 'All clear — pipeline is on track'}
      </div>
    </div>
  );
}
