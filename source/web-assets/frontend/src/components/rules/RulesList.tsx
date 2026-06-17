export default function RulesList({ rules }) {
  return (
    <div>
      <h3 className="text-2xl font-bold text-cyan-400 mb-4">Game Rules</h3>
      <ul className="space-y-3">
        {rules.map((rule, index) => (
          <li key={`rule-${rule.slice(0, 20)}-${index}`} className="flex gap-3 text-white">
            <span className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center font-bold text-sm">
              {index + 1}
            </span>
            <span className="pt-1">{rule}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
