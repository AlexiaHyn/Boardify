'use client';

import type { DefaultAction } from '@/types/game';

interface DefaultActionButtonsProps {
  actions: DefaultAction[];
  onAction: (actionType: string, targetPlayerId?: string) => void;
}

export function DefaultActionButtons({ actions, onAction }: DefaultActionButtonsProps) {
  if (!actions || actions.length === 0) {
    return null;
  }

  const getButtonColor = (color?: string) => {
    switch (color) {
      case 'red':
        return 'bg-red-600 hover:bg-red-700 border-red-500';
      case 'yellow':
        return 'bg-yellow-600 hover:bg-yellow-700 border-yellow-500';
      case 'green':
        return 'bg-green-600 hover:bg-green-700 border-green-500';
      case 'blue':
        return 'bg-blue-600 hover:bg-blue-700 border-blue-500';
      default:
        return 'bg-gray-600 hover:bg-gray-700 border-gray-500';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => onAction(action.actionType, action.targetPlayerId)}
          className={`
            ${getButtonColor(action.color)}
            text-white font-bold px-6 py-3 rounded-xl
            border-2 shadow-lg
            transition-all transform hover:scale-105
            flex items-center gap-2
            animate-bounce
          `}
          title={action.description}
        >
          {action.icon && <span className="text-2xl">{action.icon}</span>}
          <span>{action.label}</span>
          {action.targetPlayerName && (
            <span className="text-xs opacity-80">({action.targetPlayerName})</span>
          )}
        </button>
      ))}
    </div>
  );
}
