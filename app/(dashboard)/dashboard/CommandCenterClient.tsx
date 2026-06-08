'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { MessageSquare, CalendarCheck, FileText, Users, type LucideIcon } from 'lucide-react';

const STAT_ICONS: Record<string, LucideIcon> = {
  conversations: MessageSquare,
  appointments: CalendarCheck,
  applications: FileText,
  leads: Users,
};

interface Stat {
  icon: string;
  label: string;
  value: number;
  trend: string;
}

interface PipelineStage {
  stage: string;
  label: string;
  count: number;
  color: string;
}

interface RecentLead {
  id: string;
  name: string;
  message: string;
  time: string;
  stage: string;
  initials: string;
}

interface Task {
  id: string;
  title: string;
  priority?: string;
}

interface Source {
  label: string;
  count: number;
}

interface Props {
  firstName: string;
  greeting: string;
  dateStr: string;
  stats: Stat[];
  pipelineData: PipelineStage[];
  totalActive: number;
  pipelineValue: string;
  recentLeads: RecentLead[];
  tasks: Task[];
  topSources: Source[];
  maxSource: number;
}

export function CommandCenterClient({
  firstName,
  greeting,
  dateStr,
  stats,
  pipelineData,
  totalActive,
  pipelineValue,
  recentLeads,
  tasks,
  topSources,
  maxSource,
}: Props) {
  return (
    <div className="space-y-5 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">
            {greeting}, {firstName}.
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Here&apos;s what&apos;s happening with your business today.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 border border-gray-200 rounded-xl px-3 py-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="#9CA3AF" strokeWidth="1.2"/>
            <path d="M4 1V3M10 1V3M1 5H13" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Today
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
              {(() => { const Icon = STAT_ICONS[s.icon] ?? MessageSquare; return <Icon className="w-5 h-5 text-blue-600" strokeWidth={1.75} />; })()}
            </div>
            <div className="text-[28px] font-black text-gray-900">{s.value}</div>
            <div className="text-[12px] text-gray-500 mt-0.5">{s.label}</div>
            <div className="text-[11px] text-green-600 font-semibold mt-1.5">↑ {s.trend} vs yesterday</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-4">

        {/* Pipeline donut */}
        <div className="col-span-4 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[14px] font-semibold text-gray-900">Pipeline Overview</h2>
            <a href="/pipeline" className="text-[12px] text-blue-600 hover:underline">View pipeline →</a>
          </div>

          <div className="relative" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pipelineData.length > 0 ? pipelineData : [{ label: 'No data', count: 1, color: '#E5E7EB' }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={78}
                  dataKey="count"
                  paddingAngle={2}
                >
                  {(pipelineData.length > 0 ? pipelineData : [{ color: '#E5E7EB' }]).map((entry, index) => (
                    <Cell key={index} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [value, name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[24px] font-black text-gray-900">{totalActive}</span>
              <span className="text-[11px] text-gray-400">Total Loans</span>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-1.5 mt-2">
            {pipelineData.slice(0, 5).map((d) => (
              <div key={d.stage} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }}></div>
                  <span className="text-[12px] text-gray-600">{d.label}</span>
                </div>
                <span className="text-[12px] font-semibold text-gray-900">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent conversations */}
        <div className="col-span-8 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-semibold text-gray-900">Recent Conversations</h2>
            <a href="/inbox" className="text-[12px] text-blue-600 hover:underline">View all →</a>
          </div>

          {recentLeads.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No conversations yet. Add your first lead.</div>
          ) : (
            <div className="space-y-3">
              {recentLeads.map((lead) => (
                <a
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-[12px] font-bold text-blue-600 flex-shrink-0">
                    {lead.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900">{lead.name}</p>
                    <p className="text-[12px] text-gray-400 truncate">{lead.message}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] text-gray-400">{lead.time}</p>
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">{lead.stage}</span>
                  </div>
                  <div className="w-5 h-5 rounded-full border border-gray-200 flex items-center justify-center flex-shrink-0">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5H8M5 2L8 5L5 8" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Task list */}
        <div className="col-span-5 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-semibold text-gray-900">Task List</h2>
            <a href="/tasks" className="text-[12px] text-blue-600 hover:underline">View all →</a>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No pending tasks</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded border border-gray-300 flex-shrink-0"></div>
                  <span className="text-[13px] text-gray-700 flex-1">{t.title}</span>
                  {t.priority && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      t.priority === 'high' ? 'bg-red-50 text-red-500' :
                      t.priority === 'medium' ? 'bg-orange-50 text-orange-600' :
                      'bg-gray-50 text-gray-500'
                    }`}>
                      {t.priority}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top lead sources */}
        <div className="col-span-7 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-semibold text-gray-900">Top Lead Sources</h2>
            <div className="flex items-center gap-1 text-[12px] text-gray-400 border border-gray-200 rounded-lg px-2 py-1">
              This month
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2.5 3.5L5 6L7.5 3.5" stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          {topSources.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No lead source data yet</p>
          ) : (
            <div className="space-y-3">
              {topSources.map((src) => (
                <div key={src.label} className="flex items-center gap-3">
                  <span className="text-[12px] text-gray-600 w-24 flex-shrink-0 truncate">{src.label}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${(src.count / maxSource) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-[12px] font-semibold text-gray-700 w-8 text-right">{src.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
