'use client';

import { useState } from 'react';
import type { Card } from '@/types/game';

interface CardProps {
  card: Card;
  selected?: boolean;
  selectable?: boolean;
  disabled?: boolean;
  small?: boolean;
  faceDown?: boolean;
  onClick?: (card: Card) => void;
  onHover?: (card: Card | null) => void;
}

const TYPE_COLORS: Record<string, string> = {
  action:   'from-[var(--color-teal)] to-[#1a4a40] border-[var(--color-teal-bright)]',
  defense:  'from-[var(--color-verdant)] to-[#2a6b4a] border-[var(--color-verdant-bright)]',
  reaction: 'from-[var(--color-crimson)] to-[var(--color-crimson-dim)] border-[var(--color-crimson-bright)]',
  special:  'from-[var(--color-amber)] to-[#6a4a1a] border-[var(--color-amber-bright)]',
  combo:    'from-[var(--color-rose)] to-[#5a2030] border-[var(--color-rose-bright)]',
  hidden:   'from-[var(--color-surface-raised)] to-[var(--color-bg-deep)] border-[var(--color-border)]',
};

export function GameCard({
  card,
  selected = false,
  selectable = false,
  disabled = false,
  small = false,
  faceDown = false,
  onClick,
  onHover,
}: CardProps) {
  const [hovered, setHovered] = useState(false);

  const colors = TYPE_COLORS[faceDown ? 'hidden' : card.type] ?? TYPE_COLORS.action;
  const isHidden = faceDown || card.type === 'hidden';

  const handleClick = () => {
    if (!disabled && onClick) onClick(card);
  };

  const handleMouseEnter = () => {
    setHovered(true);
    if (!isHidden && onHover) onHover(card);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    if (onHover) onHover(null);
  };

  const cursor = disabled ? 'cursor-not-allowed' : selectable || onClick ? 'cursor-pointer' : 'cursor-default';
  const scale = hovered && !disabled && onClick ? 'scale-110 -translate-y-3' : '';
  const ring = selected ? 'ring-4 ring-[var(--color-gold)] ring-offset-2 ring-offset-transparent' : '';
  const opacity = disabled ? 'opacity-40' : '';

  const w = small ? 'w-14' : 'w-24';
  const h = small ? 'h-20' : 'h-36';
  const textSm = small ? 'text-xs' : 'text-sm';
  const emojiSm = small ? 'text-2xl' : 'text-4xl';

  return (
    <div
      className={`
        relative ${w} ${h} rounded-xl border-2 bg-gradient-to-br ${colors}
        ${ring} ${opacity} ${cursor} ${scale}
        transition-all duration-200 ease-out select-none
        shadow-lg flex flex-col items-center justify-between p-2
      `}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isHidden ? (
        <div className="flex flex-col items-center justify-center h-full w-full">
          <span className={emojiSm}>&#127138;</span>
          {!small && <span className="font-body text-[var(--color-stone-dim)] text-xs mt-1">Hidden</span>}
        </div>
      ) : (
        <>
          {/* Card type badge */}
          <div className="w-full flex justify-between items-start">
            <span className={`${textSm} font-bold text-[var(--color-cream)] drop-shadow leading-tight font-body`}>
              {small ? '' : card.name}
            </span>
          </div>

          {/* Emoji */}
          <div className="flex flex-col items-center justify-center flex-1">
            <span className={`${emojiSm} drop-shadow-lg`}>{card.emoji ?? '&#127139;'}</span>
            {small && (
              <span className="font-body text-[var(--color-cream)] text-xs mt-1 font-semibold text-center leading-tight px-1">
                {card.name}
              </span>
            )}
          </div>

          {/* Type label */}
          {!small && (
            <div className="w-full">
              <span className="font-body text-[var(--color-cream-dim)] text-xs capitalize">{card.type}</span>
            </div>
          )}

          {/* Reaction badge */}
          {card.isReaction && !small && (
            <div className="absolute -top-1 -right-1 bg-[var(--color-crimson)] text-[var(--color-cream)] text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow">
              R
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Tooltip card preview
interface CardTooltipProps {
  card: Card;
  visible: boolean;
}

export function CardTooltip({ card, visible }: CardTooltipProps) {
  if (!visible || card.type === 'hidden') return null;
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3 w-52 shadow-2xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{card.emoji}</span>
          <div>
            <p className="font-body font-bold text-sm text-[var(--color-cream)]">{card.name}</p>
            <p className="font-body text-[var(--color-stone-dim)] text-xs capitalize">{card.type}</p>
          </div>
        </div>
        <p className="font-body text-[var(--color-stone)] text-xs leading-relaxed">{card.description}</p>
        {card.effects.map((e, i) => (
          <p key={i} className="font-body text-[var(--color-teal-bright)] text-xs mt-1">&#8226; {e.description}</p>
        ))}
      </div>
    </div>
  );
}
