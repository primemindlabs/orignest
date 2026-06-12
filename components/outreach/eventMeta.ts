import {
  IconCake,
  IconHome,
  IconCertificate,
  IconBuildingStore,
  type IconProps,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';

export type OutreachEventType =
  | 'birthday'
  | 'home_anniversary'
  | 'loan_anniversary'
  | 'realtor_anniversary';

export const EVENT_META: Record<
  OutreachEventType,
  { label: string; Icon: ComponentType<IconProps> }
> = {
  birthday: { label: 'Birthday', Icon: IconCake },
  home_anniversary: { label: 'Home Anniversary', Icon: IconHome },
  loan_anniversary: { label: 'Loan Anniversary', Icon: IconCertificate },
  realtor_anniversary: { label: 'Partnership Anniversary', Icon: IconBuildingStore },
};
