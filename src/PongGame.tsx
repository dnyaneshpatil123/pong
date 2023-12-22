import Phaser from 'phaser';

export default class PongGame extends Phaser.Scene {
    private paddleLeft!: Phaser.GameObjects.Rectangle;
    private paddleRight!: Phaser.GameObjects.Rectangle;
    private ball!: Phaser.GameObjects.Rectangle;
    private scoreLeft: number = 0;
    private scoreRight: number = 0;
    private scoreText!: Phaser.GameObjects.Text;
    private readonly OPPONENT_SPEED = 7;
    private readonly PREDICTION_TIME = 0.5;
    private readonly RANDOM_FACTOR = 0.2;
    private readonly SMOOTHING_FACTOR = 0.5;
    private readonly PADDLE_SPEED = 7;
    private readonly PADDLE_WIDTH = 15;
    private readonly PADDLE_HEIGHT = 100;
    private readonly BALL_SIZE = 18;
    private isTouchControlActive: boolean = false;
    private touchStartPosition: Phaser.Math.Vector2 = new Phaser.Math.Vector2();
    private gameOverModal!: Phaser.GameObjects.Container;
    private restartButton!: Phaser.GameObjects.Text;
    private ballFrozen: boolean = false;

    private readonly SCORE_TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
        fontFamily: 'Arial',
        fontSize: '2.5rem',
        color: '#ffffff',
    };

    constructor() {
        super('PongGame');
    }

    preload() {
        this.load.bitmapFont('font', 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins/plugins/dist/rexbitmapfont.js');
    }

    create() {
        this.cameras.main.setBackgroundColor('#1A1F33');
        this.cameras.main.centerOn(0, 0);
        this.setupGameElements();
        this.setupPhysics();
        this.setupInput();
        this.setupScoreText();
        this.resetBall();

        const centerLine = this.createCenterLine();

        this.gameOverModal = this.createGameOverModal();

        centerLine.setDepth(0);

        this.events.on('ballMissesPaddle', () => {
            this.freezeBall();
            this.showGameOverModal();
        }, this);
    }

    update() {
        this.moveUserPaddle();
        this.moveComputerPaddle();
        this.ensurePaddlesStayWithinBoundaries();
        this.handleBallBoundaries();
        this.handlePaddleBoundaries();
        this.updateScoreText();
    }

    private setupGameElements() {
        this.paddleLeft = this.createPaddle(-this.game.renderer.width / 2 + 20);
        this.paddleRight = this.createPaddle(this.game.renderer.width / 2 - 20);
        this.ball = this.createBall();
    }

    private createPaddle(x: number): Phaser.GameObjects.Rectangle {
        return this.add.rectangle(x, 0, this.PADDLE_WIDTH, this.PADDLE_HEIGHT, 0xffffff);
    }

    private createBall(): Phaser.GameObjects.Rectangle {
        return this.add.rectangle(0, 0, this.BALL_SIZE, this.BALL_SIZE, 0xffffff);
    }

    private setupPhysics() {
        const gameElements = [this.paddleLeft, this.paddleRight, this.ball];
        this.physics.world.enable(gameElements);
        this.physics.add.collider(this.paddleLeft, this.ball, this.handlePaddleBallCollision, undefined, this);
        this.physics.add.collider(this.paddleRight, this.ball, this.handlePaddleBallCollision, undefined, this);
    }

    private setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();

        // Enable touch control for the right paddle
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.x > this.game.renderer.width / 2 && pointer.isDown) {
                this.isTouchControlActive = true;
                this.touchStartPosition.set(pointer.x, pointer.y);
            }
        });

        this.input.on('pointerup', () => {
            this.isTouchControlActive = false;
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.isTouchControlActive && pointer.x > this.game.renderer.width / 2) {
                const deltaY = pointer.y - this.touchStartPosition.y;
                this.paddleRight.y += deltaY;
                this.clampPaddlePosition(this.paddleRight);
                this.touchStartPosition.set(pointer.x, pointer.y);
            }
        });
    }

    private setupScoreText() {
        this.scoreText = this.add.text(0, -this.game.renderer.height / 2 + 50, `${this.scoreLeft}                             ${this.scoreRight}`, {
            fontFamily: 'Arial',
            fontSize: '3rem',
            color: '#ffffff',
            resolution: 2,
        });
        this.scoreText.setOrigin(0.5, 0.5);
    }

    private moveUserPaddle() {
        if (this.cursors.up.isDown && this.paddleRight.y > -this.game.renderer.height / 2 + this.paddleRight.displayHeight / 2) {
            this.paddleRight.y -= this.PADDLE_SPEED;
        } else if (this.cursors.down.isDown && this.paddleRight.y < this.game.renderer.height / 2 - this.paddleRight.displayHeight / 2) {
            this.paddleRight.y += this.PADDLE_SPEED;
        }
    }

    private moveComputerPaddle() {
        const predictedBallY = this.ball.y + this.ball.body.velocity.y * this.PREDICTION_TIME;
        const targetY = predictedBallY + Phaser.Math.Between(-this.game.renderer.height * this.RANDOM_FACTOR, this.game.renderer.height * this.RANDOM_FACTOR);

        this.smoothlyMovePaddle(this.paddleLeft, targetY, this.OPPONENT_SPEED);
    }

    private smoothlyMovePaddle(paddle: Phaser.GameObjects.Rectangle, targetY: number, speed: number) {
        const difference = targetY - paddle.y;
        const adjustment = Math.sign(difference) * Math.min(Math.abs(difference), speed);
        paddle.y += adjustment * this.SMOOTHING_FACTOR;
        this.clampPaddlePosition(paddle);
    }

    private clampPaddlePosition(paddle: Phaser.GameObjects.Rectangle) {
        const minY = -this.game.renderer.height / 2 + paddle.displayHeight / 2;
        const maxY = this.game.renderer.height / 2 - paddle.displayHeight / 2;
        paddle.y = Phaser.Math.Clamp(paddle.y, minY, maxY);
    }

    private ensurePaddlesStayWithinBoundaries() {
        this.clampPaddlePosition(this.paddleLeft);
        this.clampPaddlePosition(this.paddleRight);
    }

    private handlePaddleBoundaries() {
        this.ensurePaddlesStayWithinBoundaries();
    }

    private handleBallBoundaries() {
        const ballBounds = this.ball.getBounds();

        if (ballBounds.top < -this.game.renderer.height / 2 + this.ball.displayHeight / 2) {
            this.ball.body.velocity.y = Math.abs(this.ball.body.velocity.y);
        } else if (ballBounds.bottom > this.game.renderer.height / 2 - this.ball.displayHeight / 2) {
            this.ball.body.velocity.y = -Math.abs(this.ball.body.velocity.y);
        }

        if (ballBounds.left < -this.game.renderer.width / 2) {
            this.resetBall();
        } else if (ballBounds.right > this.game.renderer.width / 2) {
            this.resetBall();
        }
    }

    private handlePaddleBallCollision(paddle: Phaser.GameObjects.GameObject, ball: Phaser.GameObjects.GameObject) {
        const ballBody = ball.body as Phaser.Physics.Arcade.Body;
        const paddleBody = paddle.body as Phaser.Physics.Arcade.Body;

        // Reverse the ball's horizontal direction on paddle-ball collision
        ballBody.velocity.x *= -1;

        // Calculate bounce angle based on collision point
        const collisionPoint = ball.y - paddle.y;
        const normalizedCollisionPoint = Phaser.Math.Clamp(collisionPoint / (paddle.displayHeight / 2), -1, 1);
        const bounceAngle = normalizedCollisionPoint * (Math.PI / 4);

        // Apply spin to the ball based on the paddle's velocity
        const spinFactor = paddleBody.velocity.y / 10;
        ballBody.angularVelocity = spinFactor * (ball.x > 0 ? -1 : 1);

        // Modify the ball's velocity for a more realistic bounce
        const speed = Math.sqrt(ballBody.velocity.x ** 2 + ballBody.velocity.y ** 2);
        const direction = Math.sign(ballBody.velocity.x);
        ballBody.velocity.x = speed * Math.cos(bounceAngle) * direction;
        ballBody.velocity.y = speed * Math.sin(bounceAngle);

        // Separate the ball and paddle to prevent them from sticking together
        this.physics.world.overlap(ball, paddle, function () {
            const separationVector = new Phaser.Math.Vector2(ball.x - paddle.x, ball.y - paddle.y).normalize().scale(5);
            ball.x += separationVector.x;
            ball.y += separationVector.y;
        });

        // Add some randomness to the ball's velocity for variety
        const randomFactor = Phaser.Math.FloatBetween(0.9, 1.1);
        ballBody.velocity.x *= randomFactor;
        ballBody.velocity.y *= randomFactor;

        // Adjust the paddle's position based on the collision point
        const maxAdjustment = 10;
        const adjustedPosition = Phaser.Math.Clamp(paddle.y + collisionPoint, paddle.y - maxAdjustment, paddle.y + maxAdjustment);
        paddle.y = adjustedPosition;

        // Set the paddle's y-velocity to zero
        paddleBody.setVelocityY(0);

        // Increment scores when the ball hits the paddles
        if (paddle === this.paddleLeft) {
            this.scoreLeft += 1;
        } else if (paddle === this.paddleRight) {
            this.scoreRight += 1;
        }

        // Emit an event when the ball hits a paddle
        this.events.emit('ballHitsPaddle', { paddle, ball });
    }

    private updateScoreText() {
        this.scoreText.setText(`${this.scoreLeft}                             ${this.scoreRight}`);
    }

    private resetBall() {
        this.ball.setPosition(0, 0);
        const randomSignX = Math.random() < 0.5 ? -1 : 1;
        const randomSignY = Math.random() < 0.5 ? -1 : 1;
        this.ball.body.velocity.x = 200 * randomSignX;
        this.ball.body.velocity.y = 200 * randomSignY;

        this.events.emit('ballMissesPaddle');
    }

    private createCenterLine() {
        const centerLine = this.add.graphics();
        centerLine.lineStyle(10, 0xffffff, 1);
        centerLine.setDepth(1);

        const lineLength = this.game.renderer.height;
        const dashSize = 20;
        const gapSize = 15;

        for (let i = -lineLength / 2; i <= lineLength / 2; i += dashSize + gapSize) {
            centerLine.beginPath();
            centerLine.moveTo(0, i);
            centerLine.lineTo(0, i + dashSize);
            centerLine.strokePath();
        }

        return centerLine;
    }

    private createGameOverModal(): Phaser.GameObjects.Container {
        const modal = this.add.container(0, 0);

        const modalBackground = this.add.graphics();
        modalBackground.fillStyle(0x1A1F33, 1);
        modalBackground.fillGradientStyle(0x1A1F33, 0x1A1F33, 0x1A1F33, 1);
        modalBackground.fillRoundedRect(-200, -150, 400, 300);

        modalBackground.lineStyle(3, 0xffffff);
        modalBackground.strokeRoundedRect(-200, -150, 400, 300);

        const gameOverText = this.add.text(0, -100, 'Game Over !', {
            fontFamily: 'Arial',
            fontSize: '3rem',
            color: '#ffffff',
        });
        gameOverText.setOrigin(0.5, 0.5);

        const scoreText = this.add.text(0, -40, '', {});
        scoreText.setOrigin(0.5, 0.5);

        this.restartButton = this.add.text(0, 40, 'Restart', {
            fontFamily: 'Arial',
            fontSize: '2rem',
            color: '#ffffff',
            backgroundColor: '#1A1F33',
            stroke: '#ffffff',
            padding: {
                x: 20,
                y: 10,
            },
        });
        this.restartButton.setOrigin(0.5, 0.5);
        this.restartButton.setInteractive({ useHandCursor: true });
        this.restartButton.on('pointerup', () => this.restartGame());

        modal.add([modalBackground, gameOverText, scoreText, this.restartButton]);

        modal.setVisible(false);

        this.tweens.add({
            targets: modal,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 500,
            ease: 'Power2',
        });

        return modal;
    }

    private freezeBall() {
        if (!this.ballFrozen) {
            this.ball.body.velocity.setTo(0, 0);
            this.ballFrozen = true;
        }
    }

    private showGameOverModal() {
        this.gameOverModal.setVisible(true);

        // Find the existing score text in the game-over modal
        const scoreText = this.gameOverModal.getByName('scoreText') as Phaser.GameObjects.Text;

        // Update the score text content with the new score
        if (scoreText) {
            scoreText.setText(`Score: ${this.scoreRight}`);
        } else {
            // If the score text doesn't exist (first time), create and add it
            const newScoreText = this.add.text(0, -40, `Score: ${this.scoreRight}`, this.SCORE_TEXT_STYLE);
            newScoreText.setOrigin(0.5, 0.5);
            newScoreText.setName('scoreText');
            this.gameOverModal.add(newScoreText);
        }
    }

    private restartGame() {
        this.tweens.add({
            targets: this.gameOverModal,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => {
                this.scoreLeft = 0;
                this.scoreRight = 0;

                this.updateScoreText();

                this.resetBall();

                this.ballFrozen = false;

                this.gameOverModal.alpha = 1;

                this.gameOverModal.setVisible(false);
            },
        });
    }
}
