'use client';

import { useState } from 'react';
import type { Card } from '@/types/game';

interface CardProps {
  card: Card;
  selected?: boolean;
  selectable?: boolean;
  disabled?: boolean;
  small?: boolean;
  large?: boolean;
  extraLarge?: boolean;
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

// UNO-style color mapping for cards with color in their name
const UNO_COLOR_MAPPING: Record<string, string> = {
  red: 'from-[#E8232A] to-[#B51E24] border-[#FF4444]',
  blue: 'from-[#0073E6] to-[#005AB3] border-[#3399FF]',
  green: 'from-[#00A651] to-[#008040] border-[#33CC77]',
  yellow: 'from-[#FFC627] to-[#E6A820] border-[#FFD65C]',
  wild: 'from-[#9C27B0] via-[#E91E63] to-[#FF5722] border-[#FF9800]',
};

// Extract color from card name (e.g., "Red 1" -> "red", "Blue Skip" -> "blue")
function extractColorFromName(name: string): string | null {
  const lowerName = name.toLowerCase();
  for (const color of ['red', 'blue', 'green', 'yellow', 'wild']) {
    if (lowerName.includes(color)) {
      return color;
    }
  }
  return null;
}

export function GameCard({
  card,
  selected = false,
  selectable = false,
  disabled = false,
  small = false,
  large = false,
  extraLarge = false,
  faceDown = false,
  onClick,
  onHover,
}: CardProps) {
  const [hovered, setHovered] = useState(false);

  // Check if card has a color in its metadata or name (for UNO-style games)
  const metadataColor = card.metadata?.color as string | undefined;
  const nameColor = extractColorFromName(card.name);
  const cardColor = metadataColor || nameColor;
  
  const colors = cardColor 
    ? UNO_COLOR_MAPPING[cardColor]
    : TYPE_COLORS[faceDown ? 'hidden' : card.type] ?? TYPE_COLORS.action;
  
  const isHidden = faceDown || card.type === 'hidden';
  
  // Check if this is a number card (for UNO)
  const cardNumber = card.metadata?.number as number | undefined;
  const isNumberCard = cardNumber !== undefined && card.type === 'number';

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

  const w = extraLarge ? 'w-48' : large ? 'w-36' : small ? 'w-14' : 'w-24';
  const h = extraLarge ? 'h-72' : large ? 'h-52' : small ? 'h-20' : 'h-36';
  const textSm = extraLarge ? 'text-2xl' : large ? 'text-lg' : small ? 'text-xs' : 'text-sm';
  const emojiSm = extraLarge ? 'text-8xl' : large ? 'text-6xl' : small ? 'text-2xl' : 'text-4xl';
  const numberSize = extraLarge ? 'text-9xl' : large ? 'text-7xl' : small ? 'text-3xl' : 'text-5xl';

  const padding = extraLarge ? 'p-6' : large ? 'p-4' : small ? 'p-1' : 'p-2';
  const badgeSize = extraLarge ? 'w-9 h-9 text-base' : large ? 'w-7 h-7 text-sm' : 'w-5 h-5 text-xs';

  return (
    <div
      className={`
        relative ${w} ${h} rounded-xl border-2 bg-gradient-to-br ${colors}
        ${ring} ${opacity} ${cursor} ${scale}
        transition-all duration-200 ease-out select-none
        shadow-lg flex flex-col items-center justify-between ${padding}
      `}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isHidden ? (
        <div className="flex flex-col items-center justify-center h-full w-full">
          <span className={emojiSm}>&#127138;</span>
          {!small && <span className={`font-body text-[var(--color-stone-dim)] ${extraLarge ? 'text-base' : large ? 'text-sm' : 'text-xs'} mt-1`}>Hidden</span>}
        </div>
      ) : (
        <>
          {/* Card name/type in corner */}
          <div className="w-full flex justify-between items-start">
            <span className={`${textSm} font-bold text-white drop-shadow-lg leading-tight font-body`}>
              {small ? '' : card.name}
            </span>
          </div>

          {/* Center content: Number (serif font) or Emoji */}
          <div className="flex flex-col items-center justify-center flex-1">
            {isNumberCard ? (
              // Use large serif font for numbers instead of emoji
              <span 
                className={`${numberSize} font-serif font-bold text-white drop-shadow-2xl`}
                style={{ lineHeight: '1', textShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
              >
                {cardNumber}
              </span>
            ) : (
              // Use emoji for action/special cards
              <span className={`${emojiSm} drop-shadow-xl`}>{card.emoji ?? '&#127139;'}</span>
            )}
            {small && (
              <span className="font-body text-white text-xs mt-1 font-semibold text-center leading-tight px-1 drop-shadow">
                {card.name}
              </span>
            )}
          </div>

          {/* Type label */}
          {!small && (
            <div className="w-full">
              <span className={`font-body text-white text-opacity-90 ${extraLarge ? 'text-base' : large ? 'text-sm' : 'text-xs'} capitalize drop-shadow`}>
                {card.type}
              </span>
            </div>
          )}

          {/* Reaction badge */}
          {card.isReaction && !small && (
            <div className={`absolute -top-1 -right-1 bg-[var(--color-crimson)] text-[var(--color-cream)] rounded-full ${badgeSize} flex items-center justify-center font-bold shadow-lg`}>
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
