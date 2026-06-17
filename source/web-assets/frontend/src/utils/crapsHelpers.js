// Craps game logic helpers

export const calculateTotal = (die1, die2) => die1 + die2;

export const isHardway = (die1, die2) => die1 === die2;

export const getRollName = (die1, die2) => {
  const total = die1 + die2;
  const hard = isHardway(die1, die2);
  
  if (total === 2) return { name: "Snake Eyes", emoji: "🐍", special: true };
  if (total === 12) return { name: "Boxcars", emoji: "🚂", special: true };
  if (total === 3) return { name: "Ace Deuce", emoji: "🎲", special: true };
  if (total === 11) return { name: "Yo-leven", emoji: "🎯", special: true };
  if (hard) return { name: `Hard ${total}`, emoji: "💎", special: true };
  
  return { name: `${total}`, emoji: "🎲", special: false };
};

export const calculatePayout = (total, isHard, betType) => {
  const payouts = {
    horn_12: 30,
    horn_2: 30,
    horn_3: 15,
    horn_11: 15,
    hard_4: 7,
    hard_6: 9,
    hard_8: 9,
    hard_10: 7,
    field: 2,
    pass_line: 1,
    dont_pass: 1
  };

  if (isHard) {
    if (total === 4) return payouts.hard_4;
    if (total === 6) return payouts.hard_6;
    if (total === 8) return payouts.hard_8;
    if (total === 10) return payouts.hard_10;
  }
  
  if (total === 2) return payouts.horn_2;
  if (total === 3) return payouts.horn_3;
  if (total === 11) return payouts.horn_11;
  if (total === 12) return payouts.horn_12;

  return 0;
};

export const getGamePhase = (point) => {
  return point === null ? 'Come-Out' : `Point: ${point}`;
};
