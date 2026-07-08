import { WitnextWordmark } from '@/marketing/components/WitnextWordmark';

type Props = {
  className?: string;
};

export function WitnextHeroBrand({ className }: Props) {
  return <WitnextWordmark variant="hero" className={className} />;
}
