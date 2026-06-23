// Kid pushed sub-screens (canvas 09/10/12/14/16/17/18). One registry keyed by the
// KidStackParamList name, used by both the iPhone native-stack and the iPad
// split-view detail pane in KidShell.
import type { ComponentType } from 'react';
import type { KidStackParamList } from '../../navigation/types';
import { ChoreDetailScreen } from './ChoreDetailScreen';
import { WalletHistoryScreen } from './WalletHistoryScreen';
import { LogReadingScreen } from './LogReadingScreen';
import { MoveLootScreen } from './MoveLootScreen';
import { InterestScreen } from './InterestScreen';
import { ConfirmPurchaseScreen } from './ConfirmPurchaseScreen';
import { TodayScheduleScreen } from './TodayScheduleScreen';

export type KidDetailName = Exclude<keyof KidStackParamList, 'KidHome'>;

export const KID_DETAIL_SCREENS: Record<KidDetailName, ComponentType> = {
  ChoreDetail: ChoreDetailScreen,
  WalletHistory: WalletHistoryScreen,
  LogReading: LogReadingScreen,
  MoveLoot: MoveLootScreen,
  Interest: InterestScreen,
  ConfirmPurchase: ConfirmPurchaseScreen,
  TodaySchedule: TodayScheduleScreen,
};
