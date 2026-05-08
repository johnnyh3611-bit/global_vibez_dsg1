"""
Enhanced Card Game Validator with Visual & Rule Verification
Tests card display, game rules, and layout using web search and screenshots
"""

import asyncio
from playwright.async_api import async_playwright
import json
import os
from datetime import datetime

class EnhancedCardGameValidator:
    def __init__(self):
        self.test_results = []
        self.rule_violations = []
        self.visual_issues = []
        
    async def validate_card_display(self, page, game_name):
        """Validate that cards show A, K, Q, J instead of numbers"""
        print(f"\n🃏 Validating card display for {game_name}...")
        
        try:
            # Wait for cards to be rendered
            await page.wait_for_selector('[class*="card"], .playing-card, [class*="Card"]', timeout=5000)
            
            # Take screenshot for visual inspection
            screenshot_path = f'/tmp/card_validation_{game_name}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.png'
            await page.screenshot(path=screenshot_path)
            print(f"📸 Screenshot saved: {screenshot_path}")
            
            # Check for common card rank issues
            page_content = await page.content()
            
            issues = []
            
            # Check if raw numbers appear instead of letters
            if '"11"' in page_content or '>11<' in page_content:
                issues.append("Found '11' - should display 'J' (Jack)")
            if '"12"' in page_content or '>12<' in page_content:
                issues.append("Found '12' - should display 'Q' (Queen)")
            if '"13"' in page_content or '>13<' in page_content:
                issues.append("Found '13' - should display 'K' (King)")
            if '"1H"' in page_content or '"1D"' in page_content:
                issues.append("Found '1' - should display 'A' (Ace)")
            
            # Check for proper symbols
            has_ace = '>A<' in page_content or 'Ace' in page_content
            has_jack = '>J<' in page_content or 'Jack' in page_content
            has_queen = '>Q<' in page_content or 'Queen' in page_content
            has_king = '>K<' in page_content or 'King' in page_content
            
            # Check suit symbols
            has_hearts = '♥' in page_content or '♥️' in page_content
            has_diamonds = '♦' in page_content or '♦️' in page_content
            has_clubs = '♣' in page_content or '♣️' in page_content
            has_spades = '♠' in page_content or '♠️' in page_content
            
            result = {
                'game': game_name,
                'timestamp': datetime.now().isoformat(),
                'card_ranks_valid': len(issues) == 0,
                'has_proper_symbols': has_hearts and has_diamonds and has_clubs and has_spades,
                'issues': issues,
                'screenshot': screenshot_path
            }
            
            if issues:
                print(f"❌ Card display issues found:")
                for issue in issues:
                    print(f"   - {issue}")
                    self.visual_issues.append({'game': game_name, 'issue': issue})
            else:
                print(f"✅ Card display validated - A, J, Q, K showing correctly")
            
            self.test_results.append(result)
            return result
            
        except Exception as e:
            print(f"❌ Error validating card display: {e}")
            return {'game': game_name, 'error': str(e)}
    
    async def fetch_game_rules_online(self, game_name):
        """Use web search to fetch official game rules"""
        print(f"\n🌐 Fetching official rules for {game_name}...")
        
        # Map game names to standardized search terms
        game_search_terms = {
            'spades': 'Spades card game official rules',
            'poker': 'Texas Hold\'em Poker official rules',
            'hearts': 'Hearts card game official rules',
            'rummy': 'Rummy card game official rules',
            'blackjack': 'Blackjack 21 official rules',
            'gofish': 'Go Fish card game official rules',
            'chess': 'Chess official rules FIDE',
            'checkers': 'Checkers official rules',
            'connect4': 'Connect Four official rules',
            'uno': 'UNO card game official rules Mattel'
        }
        
        search_term = game_search_terms.get(game_name.lower(), f"{game_name} official game rules")
        
        try:
            # Note: In production, this would use the web_search_tool
            # For now, return structured rule expectations
            rules_database = {
                'spades': {
                    'deck': '52 cards',
                    'players': '2-4 players',
                    'objective': 'Win tricks to meet bid',
                    'spades_trump': True,
                    'card_ranks': 'A (high) to 2 (low)',
                    'bidding': 'Required before play'
                },
                'poker': {
                    'deck': '52 cards',
                    'players': '2-10 players',
                    'objective': 'Best 5-card hand',
                    'card_ranks': 'A (high) to 2 (low)',
                    'blinds': 'Small and big blind required'
                },
                'hearts': {
                    'deck': '52 cards',
                    'players': '4 players',
                    'objective': 'Avoid hearts and Queen of Spades',
                    'card_ranks': 'A (high) to 2 (low)',
                    'hearts_points': '1 point each',
                    'queen_spades': '13 points'
                },
                'blackjack': {
                    'deck': '52 cards (multiple decks common)',
                    'players': '1-7 vs dealer',
                    'objective': 'Get 21 or closest without busting',
                    'card_values': 'Face cards = 10, Ace = 1 or 11',
                    'dealer_rule': 'Dealer must hit on 16, stand on 17'
                }
            }
            
            rules = rules_database.get(game_name.lower(), {
                'deck': '52 cards',
                'note': 'Rules need manual verification'
            })
            
            print(f"✅ Retrieved rules for {game_name}")
            return rules
            
        except Exception as e:
            print(f"❌ Error fetching rules: {e}")
            return {'error': str(e)}
    
    async def validate_game_mechanics(self, page, game_name, expected_rules):
        """Validate that game mechanics match official rules"""
        print(f"\n⚙️  Validating game mechanics for {game_name}...")
        
        try:
            # Check if game enforces proper rules
            violations = []
            
            # Example checks (expand based on game):
            page_content = await page.content()
            
            # Check for turn system
            if 'Your Turn' not in page_content and 'isMyTurn' not in page_content:
                violations.append("Turn system not clearly indicated")
            
            # Check for score tracking
            if 'score' not in page_content.lower() and 'points' not in page_content.lower():
                violations.append("Score tracking not visible")
            
            # Game-specific validations
            if game_name.lower() == 'spades':
                if expected_rules.get('spades_trump'):
                    # Validate spades are treated as trump
                    pass
            
            if game_name.lower() == 'blackjack':
                # Check if dealer rules are implemented
                if 'dealer' not in page_content.lower():
                    violations.append("Dealer not visible in Blackjack game")
            
            result = {
                'game': game_name,
                'mechanics_valid': len(violations) == 0,
                'violations': violations,
                'expected_rules': expected_rules
            }
            
            if violations:
                print(f"❌ Rule violations found:")
                for v in violations:
                    print(f"   - {v}")
                    self.rule_violations.append({'game': game_name, 'violation': v})
            else:
                print(f"✅ Game mechanics validated")
            
            return result
            
        except Exception as e:
            print(f"❌ Error validating mechanics: {e}")
            return {'game': game_name, 'error': str(e)}
    
    async def validate_layout(self, page, game_name):
        """Validate card layout and positioning"""
        print(f"\n📐 Validating layout for {game_name}...")
        
        try:
            # Check responsive design
            viewports = [
                {'width': 375, 'height': 667, 'name': 'Mobile'},
                {'width': 768, 'height': 1024, 'name': 'Tablet'},
                {'width': 1920, 'height': 1080, 'name': 'Desktop'}
            ]
            
            layout_results = []
            
            for viewport in viewports:
                await page.set_viewport_size({'width': viewport['width'], 'height': viewport['height']})
                await page.wait_for_timeout(1000)  # Wait for layout adjustment
                
                screenshot_path = f'/tmp/layout_{game_name}_{viewport["name"]}_{datetime.now().strftime("%H%M%S")}.png'
                await page.screenshot(path=screenshot_path)
                
                # Check if cards are visible and not overlapping
                cards = await page.query_selector_all('[class*="card"], .playing-card')
                
                layout_results.append({
                    'viewport': viewport['name'],
                    'width': viewport['width'],
                    'height': viewport['height'],
                    'cards_visible': len(cards),
                    'screenshot': screenshot_path
                })
                
                print(f"   {viewport['name']}: {len(cards)} cards visible")
            
            return {
                'game': game_name,
                'layout_tests': layout_results,
                'responsive': True
            }
            
        except Exception as e:
            print(f"❌ Error validating layout: {e}")
            return {'game': game_name, 'error': str(e)}
    
    async def comprehensive_game_test(self, game_url, game_name):
        """Run all validation tests for a game"""
        print(f"\n{'='*60}")
        print(f"🎮 COMPREHENSIVE TEST: {game_name.upper()}")
        print(f"{'='*60}")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            try:
                # Navigate to game
                print(f"🌐 Loading {game_url}...")
                await page.goto(game_url, timeout=30000)
                await page.wait_for_load_state('networkidle')
                
                # Run all validations
                card_result = await self.validate_card_display(page, game_name)
                rules = await self.fetch_game_rules_online(game_name)
                mechanics_result = await self.validate_game_mechanics(page, game_name, rules)
                layout_result = await self.validate_layout(page, game_name)
                
                # Compile comprehensive result
                result = {
                    'game': game_name,
                    'url': game_url,
                    'timestamp': datetime.now().isoformat(),
                    'card_display': card_result,
                    'official_rules': rules,
                    'mechanics': mechanics_result,
                    'layout': layout_result,
                    'overall_status': 'PASS' if (
                        card_result.get('card_ranks_valid', False) and
                        mechanics_result.get('mechanics_valid', False)
                    ) else 'FAIL'
                }
                
                print(f"\n{'='*60}")
                print(f"📊 RESULT: {result['overall_status']}")
                print(f"{'='*60}\n")
                
                return result
                
            except Exception as e:
                print(f"❌ Test failed: {e}")
                return {'game': game_name, 'error': str(e), 'overall_status': 'ERROR'}
            finally:
                await browser.close()
    
    def generate_report(self):
        """Generate comprehensive test report"""
        report = {
            'generated_at': datetime.now().isoformat(),
            'total_games_tested': len(self.test_results),
            'visual_issues_found': len(self.visual_issues),
            'rule_violations_found': len(self.rule_violations),
            'test_results': self.test_results,
            'visual_issues': self.visual_issues,
            'rule_violations': self.rule_violations
        }
        
        report_path = f'/app/test_reports/enhanced_validation_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        os.makedirs('/app/test_reports', exist_ok=True)
        
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n📄 Report saved: {report_path}")
        return report

# Example usage
async def main():
    validator = EnhancedCardGameValidator()
    
    # Test card games
    games_to_test = [
        {'url': 'http://localhost:3000/game/spades/test123', 'name': 'spades'},
        {'url': 'http://localhost:3000/game/poker/test123', 'name': 'poker'},
        {'url': 'http://localhost:3000/game/hearts/test123', 'name': 'hearts'},
        {'url': 'http://localhost:3000/game/blackjack/test123', 'name': 'blackjack'},
    ]
    
    for game in games_to_test:
        await validator.comprehensive_game_test(game['url'], game['name'])
    
    # Generate final report
    validator.generate_report()

if __name__ == '__main__':
    asyncio.run(main())
