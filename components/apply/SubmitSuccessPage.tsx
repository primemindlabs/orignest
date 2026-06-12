'use client';

import { IconCheck } from '@tabler/icons-react';
import type { Application } from '@/types/apply';

export function SubmitSuccessPage({ application }: { application: Partial<Application> }) {
  return (
    <div className="min-h-screen bg-[#F9F9F9] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-[#C9A95C]/10 flex items-center justify-center mx-auto mb-5">
          <IconCheck size={32} className="text-[#C9A95C]" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Application Submitted!</h1>
        <p className="text-gray-500 mt-3 leading-relaxed">
          Thank you{application.borrower_first_name ? `, ${application.borrower_first_name}` : ''}! Your loan
          officer will review your application and be in touch within 24 hours.
        </p>
        <p className="text-xs text-gray-400 mt-6">Your information is secure and encrypted.</p>
      </div>
    </div>
  );
}
