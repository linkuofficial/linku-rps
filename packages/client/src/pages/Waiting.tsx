import { motion } from 'framer-motion';
import type { ToolId } from '@rps/shared';

interface Props {
  roomId: string;
  bestOf: number;
  tool: ToolId;
}

const TOOL_LABELS: Record<ToolId, string> = {
  rps: '猜拳',
  coin: '丟銅板',
  dice: '骰子',
  wheel: '輪盤',
  draw: '抽籤',
  vote: '投票',
};

export default function Waiting({ roomId, bestOf, tool }: Props) {
  const inviteUrl = `${window.location.origin}/join/${roomId}`;
  const copyLink = async () => { await navigator.clipboard.writeText(inviteUrl); };
  const usesBestOf = tool === 'rps';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center">
      <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-2">{TOOL_LABELS[tool]}</h1>
      <p className="text-sm text-gray-400 mb-10">等待對手加入...</p>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
        className="bg-gray-50 rounded-2xl p-8 mb-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={copyLink}>
        <div className="text-4xl font-mono font-extrabold tracking-[0.4em] text-gray-900 mb-2">{roomId}</div>
        <div className="text-xs text-gray-400">點擊複製邀請連結</div>
      </motion.div>
      {usesBestOf ? (
        <div className="text-sm text-gray-400">{bestOf} 局制 · 先贏 {Math.ceil(bestOf / 2)} 局</div>
      ) : (
        <div className="text-sm text-gray-400">加入後可立即同步工具操作結果</div>
      )}
      <div className="flex items-center justify-center gap-2 mt-8">
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
          className="w-2 h-2 rounded-full bg-gray-400" />
        <span className="text-xs text-gray-400">等待中</span>
      </div>
    </motion.div>
  );
}