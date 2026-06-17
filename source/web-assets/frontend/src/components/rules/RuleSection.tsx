import { Info } from 'lucide-react';

export default function RuleSection({ title, content, variant = 'default' }) {
  const variants = {
    objective: 'bg-yellow-900/30 border-2 border-yellow-500 text-yellow-400',
    win: 'bg-green-900/30 border-2 border-green-500 text-green-400',
    default: 'bg-cyan-900/30 border-2 border-cyan-500 text-cyan-400'
  };

  const className = variants[variant] || variants.default;

  return (
    <div className={`${className} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {variant === 'objective' && <Info className="w-5 h-5" />}
        {variant === 'win' && <span className="text-xl">🏆</span>}
        <h3 className="text-xl font-bold">{title}</h3>
      </div>
      <p className="text-white text-lg">{content}</p>
    </div>
  );
}
