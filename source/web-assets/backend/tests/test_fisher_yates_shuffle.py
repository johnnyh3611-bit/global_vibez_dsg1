"""
Test Fisher-Yates Shuffle Implementation
Verifies that the shuffle produces fair, random distributions
"""
import sys
sys.path.append('/home/johnnie/master-project')

from services.blackjack_multiplayer import fisher_yates_shuffle, create_deck
from collections import Counter

def test_shuffle_randomness():
    """Test that Fisher-Yates produces different shuffles"""
    print("🧪 Testing Fisher-Yates Shuffle Randomness\n")
    
    # Generate multiple shuffled decks
    num_trials = 10
    first_cards = []
    
    for i in range(num_trials):
        deck = create_deck()
        first_cards.append(deck[0]['id'])
    
    # Count unique first cards
    unique_first_cards = len(set(first_cards))
    
    print(f"✅ Generated {num_trials} shuffled decks")
    print(f"✅ First card variety: {unique_first_cards}/{num_trials} unique cards")
    print(f"   First cards: {', '.join(first_cards[:5])}...")
    
    if unique_first_cards >= num_trials * 0.7:  # At least 70% unique
        print("✅ PASS: Good randomness detected\n")
        return True
    else:
        print("❌ FAIL: Low randomness - possible issue\n")
        return False

def test_deck_completeness():
    """Test that all cards are present after shuffle"""
    print("🧪 Testing Deck Completeness After Shuffle\n")
    
    deck = create_deck()
    
    # Check deck size
    if len(deck) != 52:
        print(f"❌ FAIL: Expected 52 cards, got {len(deck)}\n")
        return False
    
    print(f"✅ Deck has correct size: {len(deck)} cards")
    
    # Check for duplicates
    card_ids = [card['id'] for card in deck]
    if len(card_ids) != len(set(card_ids)):
        print("❌ FAIL: Duplicate cards found in deck\n")
        return False
    
    print("✅ No duplicate cards found")
    
    # Check all suits present
    suits = [card['suit'] for card in deck]
    suit_counts = Counter(suits)
    
    print(f"✅ Suit distribution: {dict(suit_counts)}")
    
    if all(count == 13 for count in suit_counts.values()):
        print("✅ PASS: All suits have 13 cards\n")
        return True
    else:
        print("❌ FAIL: Incorrect suit distribution\n")
        return False

def test_shuffle_determinism():
    """Test that consecutive shuffles produce different results"""
    print("🧪 Testing Shuffle Non-Determinism\n")
    
    deck1 = create_deck()
    deck2 = create_deck()
    
    # Compare first 10 cards
    deck1_ids = [card['id'] for card in deck1[:10]]
    deck2_ids = [card['id'] for card in deck2[:10]]
    
    differences = sum(1 for a, b in zip(deck1_ids, deck2_ids) if a != b)
    
    print(f"Deck 1 (first 10): {', '.join(deck1_ids)}")
    print(f"Deck 2 (first 10): {', '.join(deck2_ids)}")
    print(f"✅ Differences in first 10 cards: {differences}/10")
    
    if differences >= 7:  # At least 70% different
        print("✅ PASS: Shuffles are producing different orders\n")
        return True
    else:
        print("❌ FAIL: Shuffles too similar\n")
        return False

def test_multiple_deck_shuffle():
    """Test shuffling combined decks (like Blackjack uses)"""
    print("🧪 Testing Multiple Deck Shuffle (Blackjack Scenario)\n")
    
    # Create 2 decks like Blackjack does
    deck1 = create_deck()
    deck2 = create_deck()
    combined = deck1 + deck2
    
    # Shuffle the combined deck
    shuffled = fisher_yates_shuffle(combined)
    
    print(f"✅ Combined deck size: {len(shuffled)} cards (should be 104)")
    
    if len(shuffled) != 104:
        print("❌ FAIL: Incorrect combined deck size\n")
        return False
    
    # Count occurrences of each rank
    ranks = [card['rank'] for card in shuffled]
    rank_counts = Counter(ranks)
    
    # Each rank should appear 8 times (2 decks × 4 suits)
    print(f"✅ Sample rank counts: A={rank_counts['A']}, K={rank_counts['K']}, 2={rank_counts['2']}")
    
    if all(count == 8 for count in rank_counts.values()):
        print("✅ PASS: All ranks appear exactly 8 times\n")
        return True
    else:
        print("❌ FAIL: Incorrect rank distribution\n")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Fisher-Yates Shuffle Algorithm Test Suite")
    print("=" * 60)
    print()
    
    results = []
    
    results.append(("Shuffle Randomness", test_shuffle_randomness()))
    results.append(("Deck Completeness", test_deck_completeness()))
    results.append(("Non-Determinism", test_shuffle_determinism()))
    results.append(("Multiple Deck Shuffle", test_multiple_deck_shuffle()))
    
    print("=" * 60)
    print("Test Results Summary")
    print("=" * 60)
    
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    total_passed = sum(passed for _, passed in results)
    print(f"\nTotal: {total_passed}/{len(results)} tests passed")
    
    if total_passed == len(results):
        print("\n🎉 All tests passed! Fisher-Yates shuffle is working correctly.")
        sys.exit(0)
    else:
        print("\n⚠️ Some tests failed. Please review implementation.")
        sys.exit(1)
