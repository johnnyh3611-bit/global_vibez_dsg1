export interface DatingProfile {
  id: string;
  name: string;
  age: number;
  bio: string;
  interests: string[];
  location: string;
}

export const SAMPLE_PROFILES: DatingProfile[] = [
  {
    id: "1",
    name: "Alex",
    age: 28,
    bio: "DeFi enthusiast who believes love should be as decentralized as finance.",
    interests: ["Solana", "hiking", "coffee"],
    location: "San Francisco",
  },
  {
    id: "2",
    name: "Jordan",
    age: 26,
    bio: "NFT artist looking for someone to mint memories with.",
    interests: ["art", "music", "travel"],
    location: "Austin",
  },
  {
    id: "3",
    name: "Sam",
    age: 30,
    bio: "Validator by day, hopeless romantic by night.",
    interests: ["staking", "cooking", "yoga"],
    location: "Miami",
  },
  {
    id: "4",
    name: "Riley",
    age: 27,
    bio: "Building on-chain apps and off-chain connections.",
    interests: ["coding", "surfing", "photography"],
    location: "Los Angeles",
  },
];
