// Kid: Today's schedule (canvas 18). Pushed from Home. A vertical timeline of the
// day's schedule items — time + dot + card — with the current item highlighted.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { listKidScheduleItems, subscribeToTable, type ScheduleItem } from '@lootloop/client';
import { useKidSession } from '../../stores/kidSession';
import { useSizeClass } from '../../hooks/useSizeClass';
import { Icon, type IconName } from '../../components/ui/Icon';
import tw from '../../lib/tw';
import { DetailHeader } from './DetailHeader';

const SCHEDULE_ICONS = new Set<string>([
  'sun', 'moon', 'utensils', 'book-open', 'circle-check-big', 'clock', 'star', 'dog', 'bed',
]);
const iconFor = (icon: string | null): IconName =>
  icon && SCHEDULE_ICONS.has(icon) ? (icon as IconName) : 'clock';

// "7:00" from a "07:00:00" / "07:00" start_time.
function timeLabel(t: string): string {
  const [hRaw, m] = t.split(':');
  const h = Number.parseInt(hRaw, 10);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m}`;
}
const toMinutes = (t: string) => {
  const [h, m] = t.split(':');
  return Number.parseInt(h, 10) * 60 + Number.parseInt(m, 10);
};

function todayLabel(): string {
  const d = new Date();
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function Item({
  item,
  current,
  nowMinutes,
}: {
  item: ScheduleItem;
  current: boolean;
  nowMinutes: number;
}) {
  const past = toMinutes(item.start_time) < nowMinutes && !current;
  return (
    <View style={tw`flex-row items-start gap-3.5`}>
      <Text style={tw.style('w-12 pt-3.5 text-right font-sans text-[13px] font-extrabold', current ? 'text-orange' : 'text-ink-400')}>
        {timeLabel(item.start_time)}
      </Text>
      <View
        style={tw.style('mt-4 rounded-full', current ? 'h-4 w-4 bg-orange' : 'h-3.5 w-3.5 bg-surface-card', {
          shadowColor: current ? '#F8C9A0' : '#D8D4CD',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 0,
          borderWidth: current ? 0 : 3,
          borderColor: current ? 'transparent' : '#D8D4CD',
        })}
      />
      <View
        style={tw.style(
          'flex-1 flex-row items-center gap-3 rounded-lg px-3.5 py-3',
          current ? 'bg-orange-soft' : 'bg-surface-card',
          current
            ? { borderWidth: 2, borderColor: '#F8C9A0' }
            : {
                shadowColor: 'rgba(32,36,58,1)',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 6,
                elevation: 2,
              },
        )}
      >
        <Icon name={iconFor(item.icon)} size={22} color={current ? '#8A4309' : past ? '#A39CAD' : '#5B63E6'} />
        <View style={tw`min-w-0 flex-1`}>
          <Text style={tw.style('font-display text-[15px] font-extrabold', current ? 'text-orange-ink' : 'text-ink-900')}>
            {item.title}
          </Text>
          {current ? (
            <Text style={tw`font-sans text-[12px] font-bold text-orange-ink opacity-80`}>Happening now</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function TodayScheduleScreen() {
  const { client, profile } = useKidSession();
  const isRegular = useSizeClass() === 'regular';
  const [items, setItems] = useState<ScheduleItem[] | null>(null);

  const load = useCallback(async () => {
    if (!client || !profile) return;
    const { data } = await listKidScheduleItems(client, profile.id);
    setItems(data ?? []);
  }, [client, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!client || !profile) return;
    const unsub = subscribeToTable(client, {
      table: 'schedule_items',
      filter: `kid_id=eq.${profile.id}`,
      onChange: () => void load(),
    });
    return () => unsub();
  }, [client, profile, load]);

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  // The current item = the last one whose start_time has passed.
  const currentId = useMemo(() => {
    if (!items) return null;
    let id: string | null = null;
    for (const it of items) if (toMinutes(it.start_time) <= nowMinutes) id = it.id;
    return id;
  }, [items, nowMinutes]);

  return (
    <View style={tw`flex-1 bg-surface-page`}>
      <DetailHeader title="My day" eyebrow={todayLabel()} />
      {items === null ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator color="#F4720E" />
        </View>
      ) : items.length === 0 ? (
        <View style={tw`flex-1 items-center justify-center px-8`}>
          <View style={tw`items-center gap-2 rounded-card bg-surface-card px-6 py-10`}>
            <Icon name="calendar-clock" size={40} color="#A39CAD" />
            <Text style={tw`text-center font-display text-[16px] font-extrabold text-ink-800`}>
              No schedule yet
            </Text>
            <Text style={tw`text-center font-sans text-[13px] font-bold text-ink-400`}>
              Your grown-up can add your daily routine.
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={tw.style('px-5 pb-8', isRegular ? 'mx-auto w-full max-w-[640px]' : '')}
        >
          {/* Timeline rail behind the dots */}
          <View style={tw`relative`}>
            <View style={tw.style('absolute w-[3px] rounded-full bg-ink-200', { left: 60, top: 18, bottom: 18 })} />
            <View style={tw`gap-3.5`}>
              {items.map((it) => (
                <Item key={it.id} item={it} current={it.id === currentId} nowMinutes={nowMinutes} />
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
