/**
 * PluginRegistry.js - Central Game Plugin Registry
 * 
 * Single source of truth for all available games.
 * Adding a new game = adding ONE line here.
 * 
 * This prevents routing chaos and maintains clean architecture.
 * 
 * Usage:
 * import { PluginRegistry } from '@/engine/PluginRegistry';
 * const plugin = PluginRegistry.get('poker');
 * const engine = new GameEngine(plugin);
 */

// Import all game plugins
// NOTE: Plugins will be created in Phase 2
// For now, this is the structure

export class PluginRegistryClass {
  constructor() {
    this.plugins = new Map();
    this.metadata = new Map();
  }
  
  /**
   * Register a new game plugin
   */
  register(gameType, pluginClass, metadata = {}) {
    this.plugins.set(gameType, pluginClass);
    this.metadata.set(gameType, {
      displayName: metadata.displayName || gameType,
      category: metadata.category || 'card',
      playerCount: metadata.playerCount || '2-6',
      difficulty: metadata.difficulty || 'medium',
      hasBetting: metadata.hasBetting || false,
      hasTricks: metadata.hasTricks || false,
      thumbnail: metadata.thumbnail || null,
      description: metadata.description || '',
      ...metadata
    });
  }
  
  /**
   * Get a plugin instance
   */
  get(gameType) {
    const PluginClass = this.plugins.get(gameType);
    if (!PluginClass) {
      throw new Error(`Game plugin '${gameType}' not found. Available: ${this.getAvailableGames().join(', ')}`);
    }
    return new PluginClass();
  }
  
  /**
   * Check if plugin exists
   */
  has(gameType) {
    return this.plugins.has(gameType);
  }
  
  /**
   * Get all available games
   */
  getAvailableGames() {
    return Array.from(this.plugins.keys());
  }
  
  /**
   * Get all metadata
   */
  getAllMetadata() {
    return Array.from(this.metadata.entries()).map(([gameType, meta]) => ({
      gameType,
      ...meta
    }));
  }
  
  /**
   * Get metadata for specific game
   */
  getMetadata(gameType) {
    return this.metadata.get(gameType);
  }
  
  /**
   * Get games by category
   */
  getByCategory(category) {
    return this.getAllMetadata().filter(meta => meta.category === category);
  }
  
  /**
   * Search games
   */
  search(query) {
    const lowerQuery = query.toLowerCase();
    return this.getAllMetadata().filter(meta =>
      meta.displayName.toLowerCase().includes(lowerQuery) ||
      meta.description.toLowerCase().includes(lowerQuery)
    );
  }
}

// Create singleton instance
export const PluginRegistry = new PluginRegistryClass();

// === REGISTER GAMES HERE ===

// Import plugins
import { BlackjackPlugin } from '@/plugins/BlackjackPlugin';
import { PokerPlugin } from '@/plugins/PokerPlugin';
import { SpadesPlugin } from '@/plugins/SpadesPlugin';
import { RummyPlugin } from '@/plugins/RummyPlugin';

// Register Blackjack (Proof of Concept)
PluginRegistry.register('blackjack', BlackjackPlugin, {
  displayName: 'Blackjack',
  category: 'casino',
  playerCount: '1-7',
  difficulty: 'easy',
  hasBetting: true,
  thumbnail: '/blackjack-card.png',
  description: 'Classic 21 card game against the dealer NOVA'
});

// Register Poker (Texas Hold'em)
PluginRegistry.register('poker', PokerPlugin, {
  displayName: 'Texas Hold\'em',
  category: 'casino',
  playerCount: '2-10',
  difficulty: 'medium',
  hasBetting: true,
  thumbnail: '/poker-card.png',
  description: 'Classic Texas Hold\'em poker with betting rounds and community cards'
});

// Register Spades
PluginRegistry.register('spades', SpadesPlugin, {
  displayName: 'Spades',
  category: 'card',
  playerCount: '4',
  difficulty: 'medium',
  hasBetting: false,
  hasTricks: true,
  thumbnail: '/spades-card.png',
  description: '4-player partnership trick-taking game with Spades as trump'
});

// Register Rummy
PluginRegistry.register('rummy', RummyPlugin, {
  displayName: 'Gin Rummy',
  category: 'card',
  playerCount: '2-6',
  difficulty: 'easy',
  hasBetting: false,
  thumbnail: '/rummy-card.png',
  description: 'Form sets and runs to reduce deadwood and knock or gin'
});

export default PluginRegistry;
