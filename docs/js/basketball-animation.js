class BasketballAnimation {
    constructor() {
        this.isAnimating = false;
        this.animationDuration = 1500; // 1.5 seconds (faster)
        this.totalScore = 0; // Track total points
        this.opponentScore = 0; // Track opponent points
        this.gameOver = false; // Track if game has ended
        this.opponentTimer = null; // Store opponent scoring timer
        this.init();
    }

    init() {
        // Create persistent score display
        this.createScoreDisplay();
        
        // Start opponent scoring
        this.startOpponentScoring();
        
        // Store bound event listener for proper removal later
        this.triggerAnimationBound = (e) => this.triggerAnimation(e);
        
        // Add click event listener to the document
        document.addEventListener('click', this.triggerAnimationBound);
    }

    createScoreDisplay() {
        // Create fixed score display in top right
        this.scoreDisplay = document.createElement('div');
        this.scoreDisplay.id = 'basketball-score';
        this.scoreDisplay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            font-size: 24px;
            background: rgba(0, 0, 0, 0.1);
            padding: 8px 12px;
            border-radius: 8px;
            z-index: 10000;
            pointer-events: none;
            backdrop-filter: blur(5px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        
        // Create close button
        this.closeButton = document.createElement('div');
        this.closeButton.id = 'basketball-close';
        this.closeButton.style.cssText = `
            position: fixed;
            top: 15px;
            right: 15px;
            font-size: 20px;
            color: rgba(255, 255, 255, 0.8);
            cursor: pointer;
            z-index: 10001;
            pointer-events: auto;
            width: 25px;
            height: 25px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        `;
        this.closeButton.textContent = '⨂';
        this.closeButton.title = 'Stop animation and hide scoreboard';
        
        // Add hover effect for close button
        this.closeButton.addEventListener('mouseenter', () => {
            this.closeButton.style.color = 'white';
            this.closeButton.style.transform = 'scale(1.1)';
        });
        
        this.closeButton.addEventListener('mouseleave', () => {
            this.closeButton.style.color = 'rgba(255, 255, 255, 0.8)';
            this.closeButton.style.transform = 'scale(1)';
        });
        
        // Add click event to close button
        this.closeButton.addEventListener('click', () => {
            this.stopAnimationAndHide();
        });
        
        this.updateScoreDisplay();
        document.body.appendChild(this.scoreDisplay);
        document.body.appendChild(this.closeButton);
    }

    updateScoreDisplay() {
        if (this.scoreDisplay) {
            const playerScore = this.convertNumberToEmojis(this.totalScore);
            const opponentScore = this.convertNumberToEmojis(this.opponentScore);
            this.scoreDisplay.textContent = `${playerScore} : ${opponentScore}`;
        }
    }

    startOpponentScoring() {
        const scoreOpponent = () => {
            // Stop scoring if game is over
            if (this.gameOver) {
                return;
            }
            
            // Randomly add 1, 2, or 3 points to opponent
            const points = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3
            this.opponentScore += points;
            this.updateScoreDisplay();
            
            // Check for game over after opponent scores
            if (this.checkGameOver()) {
                return;
            }
            
            // Show opponent scoring animation
            this.showOpponentScoringEffect(points);
            
            const nextScoreDelay = (Math.random() * 2 + 1) * 300;
            this.opponentTimer = setTimeout(scoreOpponent, nextScoreDelay);
        };
        
        // Start the opponent scoring after initial delay
        const initialDelay = (Math.random() * 2 + 1) * 1000; // 1000-3000ms
        this.opponentTimer = setTimeout(scoreOpponent, initialDelay);
    }

    checkGameOver() {
        if (this.totalScore >= 100 || this.opponentScore >= 100) {
            // Only show game over message if this is the first time reaching the condition
            if (!this.gameOver) {
                this.gameOver = true;
                
                // Clear opponent scoring timer
                if (this.opponentTimer) {
                    clearTimeout(this.opponentTimer);
                    this.opponentTimer = null;
                }
                
                // Hide score immediately before showing game over message
                this.hideScore();
                
                // Show game over message only once
                this.showGameOverMessage();
            }
            
            return true;
        }
        return false;
    }

    showGameOverMessage() {
        const gameOverDiv = document.createElement('div');
        gameOverDiv.id = 'game-over-message';
        
        const message = this.totalScore >= 100 ? '🏆' : '😭';
        
        gameOverDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            font-size: 48px;
            background: rgba(255, 255, 255, 0.95);
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 10001;
            pointer-events: none;
            backdrop-filter: blur(10px);
            border: 2px solid rgba(0, 0, 0, 0.1);
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            animation: gameOverBounce 0.8s ease-out;
        `;
        gameOverDiv.textContent = message;
        
        // Add game over animation
        const gameOverStyle = document.createElement('style');
        gameOverStyle.textContent = `
            @keyframes gameOverBounce {
                0% { transform: scale(0) rotate(-10deg); opacity: 0; }
                50% { transform: scale(1.1) rotate(5deg); opacity: 1; }
                100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
        `;
        
        if (!document.querySelector('style[data-game-over-bounce]')) {
            gameOverStyle.setAttribute('data-game-over-bounce', 'true');
            document.head.appendChild(gameOverStyle);
        }
        
        document.body.appendChild(gameOverDiv);
        
        // Hide the game over message after 5 seconds
        setTimeout(() => {
            if (gameOverDiv && gameOverDiv.parentNode) {
                gameOverDiv.style.transition = 'opacity 1s ease-out';
                gameOverDiv.style.opacity = '0';
                setTimeout(() => {
                    if (gameOverDiv.parentNode) {
                        document.body.removeChild(gameOverDiv);
                    }
                }, 1000); // Remove after fade out completes
            }
        }, 5000);
    }

    hideScore() {
        if (this.scoreDisplay) {
            this.scoreDisplay.style.opacity = '0';
            this.scoreDisplay.style.transition = 'opacity 1s ease-out';
        }
    }

    stopAnimationAndHide() {
        // Set game over to stop all animations
        this.gameOver = true;
        
        // Clear opponent scoring timer
        if (this.opponentTimer) {
            clearTimeout(this.opponentTimer);
            this.opponentTimer = null;
        }
        
        // Hide the score display
        if (this.scoreDisplay) {
            this.scoreDisplay.style.transition = 'opacity 0.3s ease-out';
            this.scoreDisplay.style.opacity = '0';
            setTimeout(() => {
                if (this.scoreDisplay && this.scoreDisplay.parentNode) {
                    document.body.removeChild(this.scoreDisplay);
                    this.scoreDisplay = null;
                }
            }, 300);
        }
        
        // Hide the close button
        if (this.closeButton) {
            this.closeButton.style.transition = 'opacity 0.3s ease-out';
            this.closeButton.style.opacity = '0';
            setTimeout(() => {
                if (this.closeButton && this.closeButton.parentNode) {
                    document.body.removeChild(this.closeButton);
                    this.closeButton = null;
                }
            }, 300);
        }
        
        // Remove any existing game over messages
        const gameOverMessage = document.getElementById('game-over-message');
        if (gameOverMessage && gameOverMessage.parentNode) {
            document.body.removeChild(gameOverMessage);
        }
        
        // Remove click event listener to stop further basketballs
        document.removeEventListener('click', this.triggerAnimationBound);
    }

    showPlayerScoringEffect(celebrationEmoji) {
        // Create celebration effect at the target point (center)
        const centerCelebration = document.createElement('div');
        centerCelebration.style.cssText = `
            position: fixed;
            left: 50%;
            top: 180px;
            transform: translateX(-50%);
            font-size: 30px;
            z-index: 10000;
            pointer-events: none;
            animation: bounce-center 0.6s ease-out;
        `;
        centerCelebration.textContent = celebrationEmoji;

        // Create celebration effect below the player score (left side)
        const scoreCelebration = document.createElement('div');
        
        // Calculate position below the score display
        const scoreRect = this.scoreDisplay.getBoundingClientRect();
        const leftPosition = scoreRect.left;
        const topPosition = scoreRect.bottom + 5; // 5px below the score
        
        scoreCelebration.style.cssText = `
            position: fixed;
            left: ${leftPosition}px;
            top: ${topPosition}px;
            font-size: 24px;
            z-index: 10000;
            pointer-events: none;
            animation: bounce 0.6s ease-out;
        `;
        scoreCelebration.textContent = celebrationEmoji;

        // Add bounce animations
        const centerStyle = document.createElement('style');
        centerStyle.textContent = `
            @keyframes bounce-center {
                0% { transform: translateX(-50%) scale(0); opacity: 0; }
                50% { transform: translateX(-50%) scale(1.2); opacity: 1; }
                100% { transform: translateX(-50%) scale(0); opacity: 0; }
            }
        `;

        const scoreStyle = document.createElement('style');
        scoreStyle.textContent = `
            @keyframes bounce {
                0% { transform: scale(0); opacity: 0; }
                50% { transform: scale(1.2); opacity: 1; }
                100% { transform: scale(0); opacity: 0; }
            }
        `;
        
        // Only add styles if they don't exist
        if (!document.querySelector('style[data-basketball-bounce-center]')) {
            centerStyle.setAttribute('data-basketball-bounce-center', 'true');
            document.head.appendChild(centerStyle);
        }
        
        if (!document.querySelector('style[data-basketball-bounce]')) {
            scoreStyle.setAttribute('data-basketball-bounce', 'true');
            document.head.appendChild(scoreStyle);
        }
        
        document.body.appendChild(centerCelebration);
        document.body.appendChild(scoreCelebration);
        
        setTimeout(() => {
            if (centerCelebration.parentNode) {
                document.body.removeChild(centerCelebration);
            }
            if (scoreCelebration.parentNode) {
                document.body.removeChild(scoreCelebration);
            }
        }, 600);
    }

    showOpponentScoringEffect(points) {
        // Determine celebration emoji based on points
        let celebrationEmoji;
        if (points === 1) {
            celebrationEmoji = '1️⃣';
        } else if (points === 2) {
            celebrationEmoji = '2️⃣';
        } else {
            celebrationEmoji = '3️⃣';
        }

        // Create celebration effect below the opponent score (right side)
        const celebration = document.createElement('div');
        
        // Calculate position below the score display (right side for opponent)
        const scoreRect = this.scoreDisplay.getBoundingClientRect();
        const rightPosition = scoreRect.right;
        const topPosition = scoreRect.bottom + 5; // 5px below the score, same as home score
        
        celebration.style.cssText = `
            position: fixed;
            left: ${rightPosition - 30}px;
            top: ${topPosition}px;
            font-size: 24px;
            z-index: 10000;
            pointer-events: none;
            animation: bounce 0.6s ease-out;
        `;
        celebration.textContent = celebrationEmoji;
        
        document.body.appendChild(celebration);
        
        setTimeout(() => {
            if (celebration.parentNode) {
                document.body.removeChild(celebration);
            }
        }, 600);
    }

    createBasketball() {
        // Create a new basketball element for each animation
        const basketball = document.createElement('div');
        basketball.className = 'animated-logo';
        basketball.style.cssText = `
            position: fixed;
            width: 60px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            pointer-events: none;
            z-index: 9999;
            opacity: 0;
            transform-origin: center;
        `;
        basketball.textContent = '🏀';
        document.body.appendChild(basketball);
        return basketball;
    }



    triggerAnimation(event) {
        // Don't allow shooting if game is over
        if (this.gameOver) {
            return;
        }
        
        // Remove the animation lock to allow multiple basketballs
        
        // Create a new basketball for this animation
        const basketball = this.createBasketball();
        
        // Get click position
        const startX = event.clientX;
        const startY = event.clientY;
        
        // Calculate target position (center, lower target point)
        const targetX = window.innerWidth / 2;
        const targetY = 180; // Even lower target point
        
        // Position the animated basketball at click position
        basketball.style.left = (startX - 30) + 'px';
        basketball.style.top = (startY - 30) + 'px';
        basketball.style.opacity = '1';
        
        // Calculate animation parameters
        const deltaX = targetX - startX;
        const deltaY = targetY - startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Create the parabolic curve animation
        this.animateLogo(basketball, startX, startY, targetX, targetY, distance);
        
        // Reset after animation completes
        setTimeout(() => {
            this.resetAnimation(basketball);
        }, this.animationDuration);
    }

    animateLogo(basketball, startX, startY, targetX, targetY, distance) {
        const startTime = performance.now();
        const peakHeight = Math.max(200, distance * 0.3); // Height of the arc
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / this.animationDuration, 1);
            
            if (progress < 1) {
                // Calculate position along the parabolic curve
                const x = startX + (targetX - startX) * progress;
                
                // Parabolic curve: y = ax² + bx + c
                // We want the curve to peak at the middle of the trajectory
                const parabolaProgress = progress;
                const y = startY + (targetY - startY) * progress - 
                         peakHeight * 4 * parabolaProgress * (1 - parabolaProgress);
                
                // Update position
                basketball.style.left = (x - 30) + 'px';
                basketball.style.top = (y - 30) + 'px';
                
                // Rotation effect (spinning like a basketball)
                const rotation = progress * 720; // 2 full rotations
                
                // Scale effect (getting smaller as it approaches the hoop)
                const scale = 1 - (progress * 0.6); // Shrink to 40% of original size
                
                // Combine transformations
                basketball.style.transform = `rotate(${rotation}deg) scale(${scale})`;
                
                // Add some fade out near the end
                if (progress > 0.8) {
                    const fadeProgress = (progress - 0.8) / 0.2;
                    basketball.style.opacity = 1 - fadeProgress;
                }
                
                requestAnimationFrame(animate);
            } else {
                // Animation complete - trigger scoring effect
                this.triggerScoringEffect(distance);
            }
        };
        
        requestAnimationFrame(animate);
    }

    triggerScoringEffect(distance) {
        // Determine shot type based on distance
        let celebrationEmoji;
        let points;
        if (distance < 150) {
            celebrationEmoji = '1️⃣'; // Free throw - very close
            points = 1;
        } else if (distance < 450) {
            celebrationEmoji = '2️⃣'; // Field goal - medium distance
            points = 2;
        } else {
            celebrationEmoji = '3️⃣'; // Three-pointer - long distance
            points = 3;
        }

        // Update total score
        this.totalScore += points;
        this.updateScoreDisplay();

        // Check for game over after player scores
        if (this.checkGameOver()) {
            return;
        }

        // Show player scoring animation at both locations
        this.showPlayerScoringEffect(celebrationEmoji);
        

    }

    convertNumberToEmojis(number) {
        const emojiDigits = ['0️', '1️', '2️', '3️', '4️', '5️', '6️', '7️', '8️', '9️'];
        return number.toString().split('').map(digit => emojiDigits[parseInt(digit)]).join('');
    }

    resetAnimation(basketball) {
        // Remove the basketball element from the DOM
        if (basketball && basketball.parentNode) {
            basketball.parentNode.removeChild(basketball);
        }
    }
}

// Initialize the animation when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new BasketballAnimation();
});