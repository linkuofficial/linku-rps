import { motion } from 'framer-motion';

interface Props { roomId: string; bestOf: number; }

export default function Waiting({ roomId, bestOf }: Props) {
  const inviteUrl = `${window.location.origin}/join/${roomId}`;
  const copyLink = async () => { await navigator.clipboard.writeText(inviteUrl); };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center">
      <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-2">猜拳</h1>
      <p className="text-sm text-gray-400 mb-10">等待對手加入...</p>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
        className="bg-gray-50 rounded-2xl p-8 mb-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={copyLink}>
        <div className="text-4xl font-mono font-extrabold tracking-[0.4em] text-gray-900 mb-2">{roomId}</div>
        <div className="text-xs text-gray-400">點擊複製邀請連結</div>
      </motion.div>
      <div className="text-sm text-gray-400">{bestOf} 局制 · 先贏 {Math.ceil(bestOf / 2)} 局</div>
      <div className="flex items-center justify-center gap-2 mt-8">
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
          className="w-2 h-2 rounded-full bg-gray-400" />
        <span className="text-xs text-gray-400">等待中</span>
      </div>
    </motion.div>
  );
}