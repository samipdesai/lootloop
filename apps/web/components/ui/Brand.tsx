import Image from 'next/image';
import { Wordmark } from './Wordmark';

// Brandmark: Looty mascot + LootLoop wordmark (spec §5 anatomy).
export function Brand({ size = 96, celebrate = false }: { size?: number; celebrate?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <Image
        src="/looty.svg"
        alt="LootLoop"
        width={size}
        height={size}
        priority
        className={celebrate ? 'drop-shadow-[0_12px_24px_rgba(240,179,21,0.45)]' : undefined}
      />
      <Wordmark className="font-display text-[32px] font-extrabold leading-none text-ink-900" />
    </div>
  );
}
