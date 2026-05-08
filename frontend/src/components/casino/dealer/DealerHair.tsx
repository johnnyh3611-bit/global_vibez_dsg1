const FadeHair = ({ dealerType }) => (
  <g>
    <path
      d="M 110 100 Q 120 80 150 80 Q 180 80 190 100 L 190 125 Q 180 120 150 120 Q 120 120 110 125 Z"
      fill={`url(#hairColor-${dealerType})`}
      stroke="rgba(6, 182, 212, 0.2)" strokeWidth="1"
    />
    <path d="M 105 110 Q 108 105 110 100 L 110 125" fill={`url(#hairColor-${dealerType})`} opacity="0.5" />
    <path d="M 195 110 Q 192 105 190 100 L 190 125" fill={`url(#hairColor-${dealerType})`} opacity="0.5" />
  </g>
);

const StyledHair = ({ dealerType }) => (
  <path
    d="M 105 95 Q 115 75 150 75 Q 185 75 195 95 L 195 135 Q 180 130 150 130 Q 120 130 105 135 Z"
    fill={`url(#hairColor-${dealerType})`}
    stroke="rgba(6, 182, 212, 0.2)" strokeWidth="1"
  />
);

const LongHair = ({ dealerType, config }) => (
  <g>
    <path
      d="M 100 90 Q 110 70 150 75 Q 190 70 200 90 L 200 175 Q 195 170 190 175 Q 185 180 180 175 L 120 175 Q 115 180 110 175 Q 105 170 100 175 Z"
      fill={`url(#hairColor-${dealerType})`}
      stroke="rgba(6, 182, 212, 0.2)" strokeWidth="1"
    />
    <path d="M 105 120 Q 100 125 105 130" stroke={config.hairColor[1]} strokeWidth="2" fill="none" opacity="0.6" />
    <path d="M 195 120 Q 200 125 195 130" stroke={config.hairColor[1]} strokeWidth="2" fill="none" opacity="0.6" />
  </g>
);

const CurlyHair = ({ dealerType, config }) => (
  <g>
    <ellipse
      cx="150" cy="95" rx="55" ry="40"
      fill={`url(#hairColor-${dealerType})`}
      stroke="rgba(6, 182, 212, 0.2)" strokeWidth="1"
    />
    {[
      [120, 85, 8], [140, 80, 9], [160, 80, 9], [180, 85, 8],
      [110, 100, 7], [190, 100, 7],
    ].map(([cx, cy, r]) => (
      <circle key={`curl-${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={config.hairColor[0]} opacity="0.7" />
    ))}
  </g>
);

export const DealerHair = ({ dealerType, config }) => {
  if (config.hairStyle === 'fade') return <FadeHair dealerType={dealerType} />;
  if (config.hairStyle === 'styled') return <StyledHair dealerType={dealerType} />;
  if (config.hairStyle === 'long') return <LongHair dealerType={dealerType} config={config} />;
  if (config.hairStyle === 'curly') return <CurlyHair dealerType={dealerType} config={config} />;
  return null;
};

export default DealerHair;
