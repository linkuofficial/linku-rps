import { motion } from 'framer-motion';
import type { ToolId } from '@rps/shared';

interface Props {
    onSelect: (tool: ToolId) => void;
}

interface ToolCard {
    id: ToolId;
    name: string;
    subtitle: string;
    enabled: boolean;
}

const TOOLS: ToolCard[] = [
    { id: 'rps', name: '猜拳', subtitle: 'Rock Paper Scissors', enabled: true },
    { id: 'coin', name: '丟銅板', subtitle: 'Coin Flip', enabled: true },
    { id: 'dice', name: '骰子', subtitle: 'Dice', enabled: true },
    { id: 'wheel', name: '輪盤', subtitle: 'Wheel', enabled: true },
    { id: 'draw', name: '抽籤', subtitle: 'Draw Lots', enabled: true },
    { id: 'vote', name: '投票', subtitle: 'Vote', enabled: true },
];

export default function ToolSelector({ onSelect }: Props) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
        >
            <div className="mb-4 px-1">
                <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">Linku Toolbox</h1>
                <p className="mt-1 text-sm text-stone-500">多人同步小工具，開房後即可分享連結</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {TOOLS.map((tool) => (
                    <button
                        key={tool.id}
                        onClick={() => tool.enabled && onSelect(tool.id)}
                        disabled={!tool.enabled}
                        className={`rounded-xl border p-4 text-left transition-all ${tool.enabled
                            ? 'border-stone-300 bg-white hover:border-stone-500 hover:shadow-sm active:scale-[0.99]'
                            : 'border-stone-200 bg-stone-100 text-stone-400 cursor-not-allowed'
                            }`}
                    >
                        <div className="text-base font-bold">{tool.name}</div>
                        <div className="mt-1 text-xs">{tool.subtitle}</div>
                        {!tool.enabled && <div className="mt-2 text-[11px] font-medium uppercase tracking-wider">Coming Soon</div>}
                    </button>
                ))}
            </div>

            <div className="mt-5 border-t border-stone-200 pt-3 text-center text-xs text-stone-500">
                Linku Tech ・
                <a href="https://linku.tech" target="_blank" rel="noreferrer" className="ml-1 font-semibold text-stone-700 hover:text-stone-900">
                    linku.tech
                </a>
            </div>
        </motion.div>
    );
}
