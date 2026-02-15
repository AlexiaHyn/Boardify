'use client';

import { useState } from 'react';
import type { DefaultAction, Choice } from '@/types/game';

interface DefaultActionButtonsProps {
  actions: DefaultAction[];
  onAction: (actionType: string, targetPlayerId?: string, metadata?: Record<string, unknown>) => void;
}

export function DefaultActionButtons({ actions, onAction }: DefaultActionButtonsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!actions || actions.length === 0) {
    return null;
  }

  const handleButtonAction = (action: DefaultAction) => {
    if (action.inputType === 'number' || action.inputType === 'choice') {
      // Toggle the expanded panel
      setExpandedId(expandedId === action.id ? null : action.id);
    } else {
      // Simple button: fire immediately
      onAction(action.actionType, action.targetPlayerId);
      setExpandedId(null);
    }
  };

  const handleNumberConfirm = (action: DefaultAction, amount: number) => {
    onAction(action.actionType, action.targetPlayerId, { amount });
    setExpandedId(null);
  };

  const handleChoiceSelect = (action: DefaultAction, choice: string) => {
    onAction(action.actionType, action.targetPlayerId, { choice });
    setExpandedId(null);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 max-w-sm">
      {actions.map((action) => (
        <div key={action.id} className="flex flex-col items-end gap-1">
          {/* Expanded panel for number/choice input */}
          {expandedId === action.id && action.inputType === 'number' && (
            <NumberInputPanel
              action={action}
              onConfirm={(amount) => handleNumberConfirm(action, amount)}
              onCancel={() => setExpandedId(null)}
            />
          )}
          {expandedId === action.id && action.inputType === 'choice' && (
            <ChoiceInputPanel
              action={action}
              onSelect={(value) => handleChoiceSelect(action, value)}
              onCancel={() => setExpandedId(null)}
            />
          )}

          {/* Action button */}
          <button
            onClick={() => handleButtonAction(action)}
            className={`
              ${getButtonColor(action.color)}
              text-white font-bold px-6 py-3 rounded-xl
              border-2 shadow-lg
              transition-all transform hover:scale-105
              flex items-center gap-2
              ${expandedId === action.id ? 'ring-2 ring-white/50' : 'animate-bounce'}
            `}
            title={action.description}
          >
            {action.icon && <span className="text-2xl">{action.icon}</span>}
            <span>{action.label}</span>
            {action.targetPlayerName && (
              <span className="text-xs opacity-80">({action.targetPlayerName})</span>
            )}
            {(action.inputType === 'number' || action.inputType === 'choice') && (
              <span className="text-xs opacity-60 ml-1">
                {expandedId === action.id ? '▼' : '▶'}
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Number Input Panel ───────────────────────────────────────────────────────

function NumberInputPanel({
  action,
  onConfirm,
  onCancel,
}: {
  action: DefaultAction;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}) {
  const config = action.inputConfig ?? {};
  const min = config.min ?? 1;
  const max = config.max ?? 9999;
  const step = config.step ?? 1;
  const label = config.label ?? 'Amount';

  const [value, setValue] = useState(min);

  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl border border-white/20 p-4 shadow-2xl min-w-[220px]">
      <p className="text-white/80 text-sm font-semibold mb-3">{label}</p>

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setValue((v) => clamp(v - step))}
          className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-lg transition-colors flex items-center justify-center"
          disabled={value <= min}
        >
          -
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(clamp(Number(e.target.value) || min))}
          min={min}
          max={max}
          step={step}
          className="flex-1 bg-gray-800 border border-white/20 rounded-lg px-3 py-2 text-white text-center font-bold text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          onClick={() => setValue((v) => clamp(v + step))}
          className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-lg transition-colors flex items-center justify-center"
          disabled={value >= max}
        >
          +
        </button>
      </div>

      {/* Quick amount buttons */}
      {max > min + step && (
        <div className="flex gap-1 mb-3 flex-wrap">
          {[min, Math.floor((max - min) / 4 + min), Math.floor((max - min) / 2 + min), max].filter(
            (v, i, arr) => arr.indexOf(v) === i && v >= min && v <= max
          ).map((preset) => (
            <button
              key={preset}
              onClick={() => setValue(preset)}
              className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                value === preset
                  ? 'bg-white/30 text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/15 hover:text-white'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(value)}
          className={`flex-1 ${getButtonColor(action.color)} text-white font-bold py-2 rounded-lg border transition-all hover:scale-[1.02]`}
        >
          Confirm
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Choice Input Panel ───────────────────────────────────────────────────────

function ChoiceInputPanel({
  action,
  onSelect,
  onCancel,
}: {
  action: DefaultAction;
  onSelect: (value: string) => void;
  onCancel: () => void;
}) {
  const config = action.inputConfig ?? {};
  const label = config.label ?? 'Make a choice';
  const choices: Choice[] = config.choices ?? [];

  if (choices.length === 0) return null;

  return (
    <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl border border-white/20 p-4 shadow-2xl min-w-[220px]">
      <p className="text-white/80 text-sm font-semibold mb-3">{label}</p>

      <div className="grid grid-cols-2 gap-2 mb-2">
        {choices.map((choice) => (
          <button
            key={choice.value}
            onClick={() => onSelect(choice.value)}
            className={`
              ${getChipColor(choice.color || action.color)}
              rounded-lg px-3 py-2 text-sm font-semibold
              border border-white/10
              transition-all transform hover:scale-105 hover:border-white/30
              flex items-center justify-center gap-1
            `}
          >
            {choice.icon && <span className="text-lg">{choice.icon}</span>}
            <span>{choice.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={onCancel}
        className="w-full text-center px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 text-xs transition-colors mt-1"
      >
        Cancel
      </button>
    </div>
  );
}

// ── Color helpers ────────────────────────────────────────────────────────────

function getButtonColor(color?: string) {
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
}

function getChipColor(color?: string) {
  switch (color) {
    case 'red':
      return 'bg-red-800/80 text-red-100 hover:bg-red-700/80';
    case 'yellow':
      return 'bg-yellow-800/80 text-yellow-100 hover:bg-yellow-700/80';
    case 'green':
      return 'bg-green-800/80 text-green-100 hover:bg-green-700/80';
    case 'blue':
      return 'bg-blue-800/80 text-blue-100 hover:bg-blue-700/80';
    default:
      return 'bg-gray-800/80 text-gray-100 hover:bg-gray-700/80';
  }
}
