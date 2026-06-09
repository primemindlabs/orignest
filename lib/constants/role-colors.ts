/** Phase 57.10 — subtle role colors for shared views (avatar rings, assignee
 * badges, team-table accents). Used only as a 2px ring or icon color — never a
 * background fill. */
import type { AppRole } from '@/lib/navigation/roles';

export const ROLE_COLORS: Record<AppRole, string> = {
  lo: '#2D7A4F',
  loa: '#3A5C7A',
  processor: '#C4724A',
  underwriter: '#B07D28',
  brand_manager: '#C9A95C',
  branch_manager: '#1D1D1F',
  ae: '#6450B4',
  ae_manager: '#4A3090',
  admin: '#86868B',
};
