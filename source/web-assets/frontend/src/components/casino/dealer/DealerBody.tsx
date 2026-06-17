import { motion } from 'framer-motion';

export const DealerBody = ({ dealerType, isDealing }) => (
  <>
    <g className="dealer-body">
      <rect
        x="100" y="200" width="100" height="140" rx="10"
        fill="url(#vestBlack)"
        stroke="rgba(6, 182, 212, 0.3)" strokeWidth="1"
      />
      <path
        d="M 110 195 L 150 195 L 145 215 L 115 215 Z"
        fill="url(#shirtWhite)"
        stroke="rgba(6, 182, 212, 0.2)" strokeWidth="0.5"
      />
      <path
        d="M 150 195 L 190 195 L 185 215 L 155 215 Z"
        fill="url(#shirtWhite)"
        stroke="rgba(6, 182, 212, 0.2)" strokeWidth="0.5"
      />
      <g transform="translate(125, 205)">
        <ellipse rx="15" ry="8" fill="#c41e3a" opacity="0.9" />
        <ellipse cx="25" rx="15" ry="8" fill="#c41e3a" opacity="0.9" />
        <rect x="10" y="-3" width="20" height="6" rx="2" fill="#a61931" opacity="0.95" />
        <ellipse rx="15" ry="8" fill="url(#holoGradient)" opacity="0.3" />
      </g>
      <circle cx="150" cy="235" r="3" fill="#ffd700" opacity="0.9" />
      <circle cx="150" cy="255" r="3" fill="#ffd700" opacity="0.9" />
      <circle cx="150" cy="275" r="3" fill="#ffd700" opacity="0.9" />
    </g>

    <g className="dealer-arms">
      <motion.g
        animate={{
          rotate: isDealing ? [0, -15, 0] : 0,
          x: isDealing ? [0, -20, 0] : 0,
        }}
        transition={{ duration: 0.6, repeat: isDealing ? Infinity : 0 }}
        style={{ transformOrigin: '120px 220px' }}
      >
        <ellipse
          cx="90" cy="250" rx="12" ry="35"
          fill={`url(#skinTone-${dealerType})`}
          stroke="rgba(6, 182, 212, 0.2)" strokeWidth="0.5"
          transform="rotate(-20 90 250)"
        />
        <ellipse
          cx="75" cy="280" rx="10" ry="15"
          fill={`url(#skinTone-${dealerType})`}
          stroke="rgba(6, 182, 212, 0.2)" strokeWidth="0.5"
        />
      </motion.g>

      <ellipse
        cx="210" cy="250" rx="12" ry="35"
        fill={`url(#skinTone-${dealerType})`}
        stroke="rgba(6, 182, 212, 0.2)" strokeWidth="0.5"
        transform="rotate(20 210 250)"
      />
      <ellipse
        cx="225" cy="280" rx="10" ry="15"
        fill={`url(#skinTone-${dealerType})`}
        stroke="rgba(6, 182, 212, 0.2)" strokeWidth="0.5"
      />
    </g>

    <rect
      x="135" y="175" width="30" height="25" rx="8"
      fill={`url(#skinTone-${dealerType})`}
      stroke="rgba(6, 182, 212, 0.2)" strokeWidth="0.5"
    />
  </>
);

export default DealerBody;
