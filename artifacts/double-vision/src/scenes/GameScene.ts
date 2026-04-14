import Phaser from "phaser";
import { WORLDS, TILE, LEVEL_WIDTH, LEVEL_HEIGHT, PHYSICS, CHECKPOINT_COUNT } from "../worlds/WorldConfig";
import { generateLevel, type LevelTile } from "../worlds/LevelGenerator";
import { markWorldCompleted, allWorldsCompleted } from "../ProgressManager";

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle & { body: Phaser.Physics.Arcade.Body };
  private cursors!: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    jump: Phaser.Input.Keyboard.Key;
    duck: Phaser.Input.Keyboard.Key;
  };
  private groundGroup!: Phaser.Physics.Arcade.StaticGroup;
  private platformGroup!: Phaser.Physics.Arcade.StaticGroup;
  private killGroup!: Phaser.Physics.Arcade.StaticGroup;
  private spikeGroup!: Phaser.Physics.Arcade.Group;
  private movementGroup!: Phaser.Physics.Arcade.StaticGroup;
  private caveGroup!: Phaser.Physics.Arcade.StaticGroup;
  private checkpoints: { x: number; y: number; reached: boolean; marker: Phaser.GameObjects.Container }[] = [];
  private worldIndex: number = 0;
  private deaths: number = 0;
  private startTime: number = 0;
  private lastCheckpointX: number = 0;
  private lastCheckpointY: number = 0;
  private isDead: boolean = false;
  private isDucking: boolean = false;
  private deathText!: Phaser.GameObjects.Text;
  private worldText!: Phaser.GameObjects.Text;
  private waterTimers: Map<Phaser.GameObjects.Rectangle, number> = new Map();

  private lavaSplashParticles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: number; groundY: number }[] = [];
  private lavaSplashGfx: Phaser.GameObjects.Graphics | null = null;
  private sprayTimers: { sprite: Phaser.GameObjects.Rectangle; timer: number; active: boolean; baseY: number; gfx?: Phaser.GameObjects.Graphics; dome?: Phaser.GameObjects.Graphics }[] = [];
  private landslideData: { tile: Phaser.GameObjects.Rectangle; dir: number; speed: number; gfx: Phaser.GameObjects.Graphics; timer: number; tileWidth: number }[] = [];
  private activeWaves: { gfx: Phaser.GameObjects.Graphics; x: number; y: number; targetX: number; speed: number; life: number; maxLife: number; catching: boolean }[] = [];
  private waveSpawnTimer: number = 0;
  private waveSpawnInterval: number = 2500;
  private oceanGfx: Phaser.GameObjects.Graphics | null = null;
  private oceanTimer: number = 0;
  private vineSwings: { pivot: Phaser.GameObjects.Rectangle; platform: Phaser.GameObjects.Rectangle; angle: number; baseX: number }[] = [];
  private tankPushers: { rect: Phaser.GameObjects.Rectangle; dir: number }[] = [];
  private bullets: Phaser.Physics.Arcade.Group | null = null;
  private bulletTimer: number = 0;
  private isPaused: boolean = false;
  private pauseContainer: Phaser.GameObjects.Container | null = null;
  private pauseKey1!: Phaser.Input.Keyboard.Key;
  private pauseKey2!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: "GameScene" });
  }

  create(data: { worldIndex: number; deaths: number; startTime: number }) {
    this.worldIndex = data.worldIndex;
    this.deaths = data.deaths;
    this.startTime = data.startTime;
    this.isDead = false;
    this.isDucking = false;
    this.isPaused = false;
    this.pauseContainer = null;
    this.checkpoints = [];
    this.waterTimers = new Map();

    this.lavaSplashParticles = [];
    this.lavaSplashGfx = null;
    this.sprayTimers = [];
    this.landslideData = [];
    this.activeWaves = [];
    this.waveSpawnTimer = 0;
    this.waveSpawnInterval = 2500;
    this.oceanGfx = null;
    this.oceanTimer = 0;
    this.vineSwings = [];
    this.tankPushers = [];
    this.bullets = null;
    this.bulletTimer = 0;

    const world = WORLDS[this.worldIndex];

    this.cameras.main.setBackgroundColor(Phaser.Display.Color.IntegerToColor(world.bgColor).rgba);

    this.groundGroup = this.physics.add.staticGroup();
    this.platformGroup = this.physics.add.staticGroup();
    this.killGroup = this.physics.add.staticGroup();
    this.spikeGroup = this.physics.add.group({ allowGravity: false });
    this.movementGroup = this.physics.add.staticGroup();
    this.caveGroup = this.physics.add.staticGroup();

    const levelTiles = generateLevel(this.worldIndex);
    this.buildLevel(levelTiles, world);

    const spawnX = 3 * TILE;
    const spawnY = (12 - 2) * TILE;
    this.lastCheckpointX = spawnX;
    this.lastCheckpointY = spawnY;

    const playerRect = this.add.rectangle(spawnX, spawnY, 28, PHYSICS.NORMAL_HEIGHT, 0x4488ff);
    playerRect.setStrokeStyle(2, 0x66aaff);
    this.physics.add.existing(playerRect);
    this.player = playerRect as any;
    this.player.body.setCollideWorldBounds(false);
    this.player.body.setSize(28, PHYSICS.NORMAL_HEIGHT);

    this.physics.add.collider(this.player, this.groundGroup);
    this.physics.add.collider(this.player, this.platformGroup);
    this.physics.add.collider(this.player, this.caveGroup);

    this.physics.add.overlap(this.player, this.killGroup, (_p, _kill) => {
      this.handleDeath();
    }, undefined, this);
    this.physics.add.overlap(this.player, this.spikeGroup, (_p, spike) => {
      const s = spike as Phaser.GameObjects.Rectangle;
      if (s.visible) this.handleDeath();
    }, undefined, this);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH * TILE, 15 * TILE);
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH * TILE, 20 * TILE);

    this.cursors = {
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      jump: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      duck: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    };

    this.pauseKey1 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.pauseKey2 = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);
    const handlePause = () => this.togglePause();
    this.pauseKey1.on("down", handlePause);
    this.pauseKey2.on("down", handlePause);

    this.events.on("shutdown", () => {
      this.pauseKey1.off("down", handlePause);
      this.pauseKey2.off("down", handlePause);
    });

    this.worldText = this.add.text(16, 16, world.name, {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#ffffff",
    }).setScrollFactor(0).setDepth(100);

    const pauseBtn = this.add.text(this.cameras.main.width / 2, 16, "[ || ]", {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#cccccc",
      backgroundColor: "#0a0a1e",
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    pauseBtn.on("pointerover", () => pauseBtn.setColor("#ffffff"));
    pauseBtn.on("pointerout", () => pauseBtn.setColor("#cccccc"));
    pauseBtn.on("pointerdown", () => this.togglePause());

    this.deathText = this.add.text(784, 16, `Deaths: ${this.deaths}`, {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#e94560",
    }).setScrollFactor(0).setOrigin(1, 0).setDepth(100);

    if (this.worldIndex === 3) {
      this.bullets = this.physics.add.group({ allowGravity: false });
      this.physics.add.overlap(this.player, this.bullets, () => this.handleDeath(), undefined, this);
    }

    if (this.worldIndex === 0) {
      this.lavaSplashGfx = this.add.graphics();
    }

    if (this.worldIndex === 1) {
      this.oceanGfx = this.add.graphics().setDepth(55).setScrollFactor(0);
    }
  }

  private buildLevel(tiles: LevelTile[], world: typeof WORLDS[0]) {
    const checkpointSpacing = Math.floor(LEVEL_WIDTH / (CHECKPOINT_COUNT + 1));

    tiles.forEach((tile) => {
      const px = tile.x * TILE + TILE / 2;
      const py = tile.y * TILE + TILE / 2;

      switch (tile.type) {
        case "ground": {
          const g = this.add.rectangle(px, py, TILE, TILE, world.groundColor);
          this.groundGroup.add(g);
          (g.body as Phaser.Physics.Arcade.StaticBody).setSize(TILE, TILE);
          break;
        }
        case "platform": {
          const p = this.add.rectangle(px, py, TILE, TILE, world.platformColor);
          p.setStrokeStyle(1, 0x000000, 0.3);
          this.platformGroup.add(p);
          (p.body as Phaser.Physics.Arcade.StaticBody).setSize(TILE, TILE);
          break;
        }
        case "kill": {
          if (this.worldIndex === 1) {
            const finGfx = this.add.graphics();
            finGfx.fillStyle(0x555555, 1);
            const finH = TILE * 1.3;
            const finW = TILE * 0.8;
            const baseY = py;
            const tipX = px;
            const tipY = baseY - finH;
            finGfx.fillTriangle(
              tipX - finW * 0.15, baseY,
              tipX, tipY,
              tipX + finW * 0.85, baseY
            );
            finGfx.fillStyle(0x444444, 1);
            finGfx.fillTriangle(
              tipX, tipY,
              tipX + finW * 0.85, baseY,
              tipX + finW * 0.3, baseY
            );
            const tipH = finH * 0.2;
            finGfx.fillStyle(0xffffff, 0.9);
            finGfx.fillTriangle(
              tipX - finW * 0.05, baseY - finH + tipH,
              tipX, tipY,
              tipX + finW * 0.25, baseY - finH + tipH
            );
            const k = this.add.rectangle(px, py - finH / 2, TILE, finH, 0x000000, 0);
            this.killGroup.add(k);
            (k.body as Phaser.Physics.Arcade.StaticBody).setSize(TILE, finH);
          } else if (this.worldIndex === 0) {
            const puddleH = 10;
            const puddleY = py - TILE / 2;
            const k = this.add.rectangle(px, puddleY, TILE, puddleH, world.killBlockColor, 0.85);
            this.killGroup.add(k);
            (k.body as Phaser.Physics.Arcade.StaticBody).setSize(TILE, puddleH);

            const speckleGfx = this.add.graphics();
            const speckSeed = (tile.x * 73 + tile.y * 137) % 1000;
            const speckRng = (i: number) => ((speckSeed + i * 397) % 1000) / 1000;
            speckleGfx.fillStyle(0xff4400, 0.5);
            speckleGfx.fillEllipse(px, puddleY, TILE - 4, puddleH - 2);
            for (let i = 0; i < 5; i++) {
              const sx = px - TILE / 2 + 2 + speckRng(i) * (TILE - 4);
              const sy = puddleY - puddleH / 2 + speckRng(i + 10) * puddleH;
              const size = 1 + speckRng(i + 20) * 2;
              const color = speckRng(i + 30) > 0.5 ? 0xffdd00 : 0xffee55;
              speckleGfx.fillStyle(color, 0.8);
              speckleGfx.fillCircle(sx, sy, size);
            }
          } else {
            const k = this.add.rectangle(px, py, TILE, TILE, world.killBlockColor);
            k.setStrokeStyle(1, 0xffffff, 0.2);
            this.killGroup.add(k);
            (k.body as Phaser.Physics.Arcade.StaticBody).setSize(TILE, TILE);
          }
          break;
        }
        case "spike": {
          this.createSpike(px, py, world);
          break;
        }
        case "movement": {
          this.createMovement(px, py, world, tile.x, tile.width ?? 1);
          break;
        }
        case "cave": {
          const groundSurfaceY = (LEVEL_HEIGHT - 2) * TILE;
          const caveGap = 20;
          const caveH = TILE;
          const caveWidth = tile.width ?? 2;
          const totalW = TILE * caveWidth;
          const centerX = px + (caveWidth - 1) * TILE / 2;
          const caveCenterY = groundSurfaceY - caveGap - caveH / 2;
          const caveLeft = centerX - totalW / 2;

          const caveGfx = this.add.graphics();

          caveGfx.fillStyle(0x2a0e0e, 1);
          caveGfx.fillRect(caveLeft, caveCenterY - caveH / 2, totalW, caveH);

          caveGfx.fillStyle(0x1a0808, 1);
          caveGfx.fillRect(caveLeft, caveCenterY - caveH / 2, totalW, 4);
          caveGfx.fillStyle(0x3a1818, 0.8);
          caveGfx.fillRect(caveLeft, caveCenterY + caveH / 2 - 6, totalW, 6);

          const rockSeed = (tile.x * 53 + tile.y * 97) % 1000;
          const rockRng = (i: number) => ((rockSeed + i * 311) % 1000) / 1000;
          const speckleCount = 4 * caveWidth;
          for (let i = 0; i < speckleCount; i++) {
            const rx = caveLeft + 2 + rockRng(i) * (totalW - 4);
            const ry = caveCenterY - caveH / 2 + 4 + rockRng(i + 10) * (caveH - 8);
            const rsize = 1 + rockRng(i + 20) * 3;
            const shade = rockRng(i + 30) > 0.5 ? 0x4a1e1e : 0x1e0a0a;
            caveGfx.fillStyle(shade, 0.7);
            caveGfx.fillCircle(rx, ry, rsize);
          }

          caveGfx.fillStyle(0x000000, 0.35);
          caveGfx.fillRect(caveLeft, caveCenterY + caveH / 2 - 3, totalW, 5);

          caveGfx.lineStyle(2, 0x1a0808, 0.9);
          caveGfx.strokeRect(caveLeft, caveCenterY - caveH / 2, totalW, caveH);

          caveGfx.fillStyle(0x2a0e0e, 1);
          caveGfx.fillTriangle(
            caveLeft - 6, caveCenterY + caveH / 2,
            caveLeft, caveCenterY + caveH / 2,
            caveLeft, caveCenterY + caveH / 2 - 10
          );
          caveGfx.fillTriangle(
            caveLeft + totalW + 6, caveCenterY + caveH / 2,
            caveLeft + totalW, caveCenterY + caveH / 2,
            caveLeft + totalW, caveCenterY + caveH / 2 - 10
          );

          caveGfx.fillStyle(0x000000, 0.2);
          caveGfx.fillTriangle(
            caveLeft - 6, caveCenterY + caveH / 2,
            caveLeft, caveCenterY + caveH / 2,
            caveLeft, caveCenterY + caveH / 2 - 10
          );
          caveGfx.fillTriangle(
            caveLeft + totalW + 6, caveCenterY + caveH / 2,
            caveLeft + totalW, caveCenterY + caveH / 2,
            caveLeft + totalW, caveCenterY + caveH / 2 - 10
          );

          const caveBlock = this.add.rectangle(centerX, caveCenterY, totalW, caveH, 0x000000, 0);
          this.caveGroup.add(caveBlock);
          (caveBlock.body as Phaser.Physics.Arcade.StaticBody).setSize(totalW, caveH);

          const stackTop = caveCenterY - caveH / 2;
          const stackRows = 3;
          for (let row = 0; row < stackRows; row++) {
            const rowY = stackTop - TILE * row - TILE / 2;
            const rowColors = [0x2a0e0e, 0x220b0b, 0x1a0808];
            caveGfx.fillStyle(rowColors[row] || 0x1a0808, 1);
            caveGfx.fillRect(caveLeft, rowY - TILE / 2, totalW, TILE);

            caveGfx.lineStyle(1, 0x1a0808, 0.6);
            caveGfx.strokeRect(caveLeft, rowY - TILE / 2, totalW, TILE);

            for (let i = 0; i < 3 * caveWidth; i++) {
              const sx = caveLeft + 2 + rockRng(i + 50 + row * 20) * (totalW - 4);
              const sy = rowY - TILE / 2 + 2 + rockRng(i + 60 + row * 20) * (TILE - 4);
              const ss = 1 + rockRng(i + 70 + row * 20) * 2;
              caveGfx.fillStyle(rockRng(i + 80 + row * 20) > 0.5 ? 0x3a1818 : 0x150606, 0.6);
              caveGfx.fillCircle(sx, sy, ss);
            }

            const stackBlock = this.add.rectangle(centerX, rowY, totalW, TILE, 0x000000, 0);
            this.caveGroup.add(stackBlock);
            (stackBlock.body as Phaser.Physics.Arcade.StaticBody).setSize(totalW, TILE);
          }

          const topRowY = stackTop - TILE * stackRows;
          caveGfx.fillStyle(0x2a0e0e, 1);
          const jagPoints = 5 + caveWidth * 2;
          for (let j = 0; j < jagPoints; j++) {
            const jx = caveLeft + (j / (jagPoints - 1)) * totalW;
            const jh = 4 + rockRng(j + 100) * 8;
            caveGfx.fillTriangle(
              jx - 4 - rockRng(j + 110) * 3, topRowY,
              jx + rockRng(j + 120) * 2, topRowY - jh,
              jx + 4 + rockRng(j + 130) * 3, topRowY
            );
          }

          break;
        }
        case "checkpoint": {
          const groundSurfaceY = (LEVEL_HEIGHT - 2) * TILE;
          const flagY = groundSurfaceY - 20;
          const container = this.add.container(px, flagY);
          const pole = this.add.rectangle(0, 8, 4, 40, 0xcccccc);
          const flag = this.add.triangle(6, -4, 0, 0, 0, 16, 16, 8, world.checkpointColor);
          container.add([pole, flag]);
          this.checkpoints.push({ x: px, y: flagY, reached: false, marker: container });
          break;
        }
      }
    });
  }

  private createSpike(px: number, py: number, world: typeof WORLDS[0]) {
    switch (this.worldIndex) {
      case 0: {
        const groundY = py + TILE / 2;
        const spray = this.add.rectangle(px, groundY, 12, 4, world.spikeColor, 0);
        this.spikeGroup.add(spray);
        (spray.body as Phaser.Physics.Arcade.Body).setSize(12, 4);
        spray.setVisible(false);
        const dome = this.add.graphics();
        dome.fillStyle(0xaa0000, 0.7);
        dome.fillEllipse(px, groundY + 2, 14, 8);
        dome.fillStyle(0xcc2200, 0.5);
        dome.fillEllipse(px, groundY + 1, 10, 5);
        const sprayGfx = this.add.graphics();
        this.sprayTimers.push({ sprite: spray, timer: 0, active: false, baseY: groundY, gfx: sprayGfx, dome });
        break;
      }
      case 1: {
        const urchinGfx = this.add.graphics();
        const radius = 7;
        const spikeLen = 5;
        const numSpikes = 10;
        urchinGfx.fillStyle(world.spikeColor, 1);
        urchinGfx.fillCircle(px, py, radius);
        urchinGfx.fillStyle(0x1a0a2e, 1);
        urchinGfx.fillCircle(px, py, radius - 2);
        urchinGfx.lineStyle(1.5, 0x3d1f56, 1);
        for (let i = 0; i < numSpikes; i++) {
          const angle = (i / numSpikes) * Math.PI * 2;
          const x1 = px + Math.cos(angle) * radius;
          const y1 = py + Math.sin(angle) * radius;
          const x2 = px + Math.cos(angle) * (radius + spikeLen);
          const y2 = py + Math.sin(angle) * (radius + spikeLen);
          urchinGfx.lineBetween(x1, y1, x2, y2);
        }
        const hitRadius = radius + spikeLen;
        const urchinHitbox = this.add.rectangle(px, py, hitRadius * 2, hitRadius * 2, 0x000000, 0);
        this.spikeGroup.add(urchinHitbox);
        (urchinHitbox.body as Phaser.Physics.Arcade.Body).setCircle(hitRadius, 0, 0);
        break;
      }
      case 2: {
        const thorn = this.add.rectangle(px, py, 20, 20, world.spikeColor);
        thorn.setStrokeStyle(2, 0x1a4010);
        this.spikeGroup.add(thorn);
        (thorn.body as Phaser.Physics.Arcade.Body).setSize(20, 20);
        break;
      }
      case 3: {
        const wire = this.add.rectangle(px, py, TILE, 8, world.spikeColor);
        wire.setStrokeStyle(1, 0xaaaaaa);
        this.spikeGroup.add(wire);
        (wire.body as Phaser.Physics.Arcade.Body).setSize(TILE, 8);
        break;
      }
    }
  }

  private createMovement(px: number, py: number, world: typeof WORLDS[0], tileX: number, tileWidth: number = 1) {
    switch (this.worldIndex) {
      case 0: {
        const conveyorH = TILE / 2;
        const conveyorW = TILE * tileWidth;
        const centerX = px + (tileWidth - 1) * TILE / 2;
        const surfaceY = py - TILE / 2;
        const conveyorY = surfaceY - conveyorH / 2;
        const dir = tileX % 2 === 0 ? 1 : -1;
        const speedVariants = [100, 200, 300];
        const colorVariants = [0x8b6340, 0x6b4226, 0x3d2010];
        const speedIdx = (tileX * 31 + 7) % speedVariants.length;
        const speed = speedVariants[speedIdx];
        const slide = this.add.rectangle(centerX, conveyorY, conveyorW, conveyorH, colorVariants[speedIdx]);
        slide.setStrokeStyle(2, 0x4a2e18);
        this.movementGroup.add(slide);
        (slide.body as Phaser.Physics.Arcade.StaticBody).setSize(conveyorW, conveyorH);
        const gfx = this.add.graphics();
        this.landslideData.push({ tile: slide, dir, speed, gfx, timer: 0, tileWidth });
        break;
      }
      case 1: {
        break;
      }
      case 2: {
        const vine = this.add.rectangle(px, py - TILE * 3, 6, TILE * 2, world.movementColor);
        const platform = this.add.rectangle(px, py - TILE, TILE, 8, 0x8b4513);
        this.platformGroup.add(platform);
        (platform.body as Phaser.Physics.Arcade.StaticBody).setSize(TILE, 8);
        this.vineSwings.push({ pivot: vine, platform, angle: 0, baseX: px });
        break;
      }
      case 3: {
        const tank = this.add.rectangle(px, py, TILE * 2, TILE, world.movementColor);
        tank.setStrokeStyle(2, 0x333333);
        this.movementGroup.add(tank);
        (tank.body as Phaser.Physics.Arcade.StaticBody).setSize(TILE * 2, TILE);
        this.tankPushers.push({ rect: tank, dir: tileX % 2 === 0 ? 1 : -1 });
        break;
      }
    }
  }

  update(_time: number, delta: number) {
    if (this.isPaused) return;
    if (this.isDead) return;

    if (this.player.y > 18 * TILE) {
      this.handleDeath();
      return;
    }

    let moveX = 0;
    if (this.cursors.left.isDown) moveX -= PHYSICS.MOVE_SPEED;
    if (this.cursors.right.isDown) moveX += PHYSICS.MOVE_SPEED;
    this.player.body.setVelocityX(moveX);

    const onGround = this.player.body.blocked.down || this.player.body.touching.down;

    if (Phaser.Input.Keyboard.JustDown(this.cursors.jump) && onGround) {
      this.player.body.setVelocityY(PHYSICS.JUMP_VELOCITY);
    }

    if (this.cursors.duck.isDown && !this.isDucking) {
      this.isDucking = true;
      this.player.setSize(28, PHYSICS.DUCK_HEIGHT);
      this.player.body.setSize(28, PHYSICS.DUCK_HEIGHT);
      this.player.y += (PHYSICS.NORMAL_HEIGHT - PHYSICS.DUCK_HEIGHT) / 2;
    } else if (!this.cursors.duck.isDown && this.isDucking) {
      const heightDiff = PHYSICS.NORMAL_HEIGHT - PHYSICS.DUCK_HEIGHT;
      const proposedTop = this.player.body.y - heightDiff;
      let blocked = false;
      this.caveGroup.children.each((child: Phaser.GameObjects.GameObject) => {
        const body = (child as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.StaticBody;
        const caveLeft = body.x;
        const caveRight = body.x + body.width;
        const caveTop = body.y;
        const caveBottom = body.y + body.height;
        const playerLeft = this.player.body.x;
        const playerRight = this.player.body.x + this.player.body.width;
        if (playerRight > caveLeft && playerLeft < caveRight &&
            proposedTop < caveBottom && this.player.body.bottom > caveTop) {
          blocked = true;
        }
        return true;
      });
      if (!blocked) {
        this.isDucking = false;
        this.player.setSize(28, PHYSICS.NORMAL_HEIGHT);
        this.player.body.setSize(28, PHYSICS.NORMAL_HEIGHT);
        this.player.y -= heightDiff / 2;
      }
    }

    this.updateWorldMechanics(delta);
    this.checkCheckpoints();

    if (this.player.x > (LEVEL_WIDTH - 3) * TILE) {
      this.completeWorld();
    }
  }

  private updateWorldMechanics(delta: number) {
    switch (this.worldIndex) {
      case 0:

        this.updateLavaSpray(delta);
        this.updateLandslide(delta);
        break;
      case 1:
        this.updateWaterBlock(delta);
        this.updateWaves(delta);
        break;
      case 2:
        this.updateVineSwings(delta);
        break;
      case 3:
        this.updateTankPush();
        this.updateBullets(delta);
        break;
    }
  }


  private updateLavaSpray(delta: number) {
    this.sprayTimers.forEach((s) => {
      s.timer += delta;
      const cycle = s.timer % 3000;
      if (cycle < 1500 && !s.active) {
        s.active = true;
        s.sprite.setVisible(true);
        s.sprite.setSize(12, 48);
        (s.sprite.body as Phaser.Physics.Arcade.Body).setSize(12, 48);
        s.sprite.y = s.baseY - 24;
      } else if (cycle >= 1500 && s.active) {
        s.active = false;
        s.sprite.setVisible(false);
        s.sprite.setSize(12, 4);
        (s.sprite.body as Phaser.Physics.Arcade.Body).setSize(12, 4);
        s.sprite.y = s.baseY;
      }

      if (s.gfx) {
        s.gfx.clear();
        if (s.active) {
          const cx = s.sprite.x;
          const baseY = s.baseY;
          const sprayH = 48;
          const topY = baseY - sprayH;
          const wobble = Math.sin(s.timer * 0.008) * 2;

          s.gfx.fillStyle(0xdd0000, 0.9);
          s.gfx.beginPath();
          s.gfx.moveTo(cx - 3, baseY);
          s.gfx.lineTo(cx - 8 + wobble, topY + sprayH * 0.3);
          s.gfx.lineTo(cx - 10 + wobble, topY + sprayH * 0.1);
          s.gfx.lineTo(cx - 6 + wobble * 0.5, topY);
          s.gfx.lineTo(cx + wobble * 0.5, topY - 4);
          s.gfx.lineTo(cx + 6 + wobble * 0.5, topY);
          s.gfx.lineTo(cx + 10 - wobble, topY + sprayH * 0.1);
          s.gfx.lineTo(cx + 8 - wobble, topY + sprayH * 0.3);
          s.gfx.lineTo(cx + 3, baseY);
          s.gfx.closePath();
          s.gfx.fillPath();

          s.gfx.fillStyle(0xff4400, 0.6);
          s.gfx.beginPath();
          s.gfx.moveTo(cx - 2, baseY);
          s.gfx.lineTo(cx - 5 + wobble, topY + sprayH * 0.4);
          s.gfx.lineTo(cx - 3 + wobble * 0.5, topY + sprayH * 0.15);
          s.gfx.lineTo(cx, topY + 2);
          s.gfx.lineTo(cx + 3 - wobble * 0.5, topY + sprayH * 0.15);
          s.gfx.lineTo(cx + 5 - wobble, topY + sprayH * 0.4);
          s.gfx.lineTo(cx + 2, baseY);
          s.gfx.closePath();
          s.gfx.fillPath();

          if (Math.random() < 0.3 && this.lavaSplashParticles.length < 50) {
            const spread = 30;
            this.lavaSplashParticles.push({
              x: cx + (Math.random() - 0.5) * 6,
              y: topY + Math.random() * 10,
              vx: (Math.random() - 0.5) * spread * 2,
              vy: -(Math.random() * 40 + 20),
              life: 0,
              maxLife: 600 + Math.random() * 400,
              size: 2 + Math.random() * 3,
              color: Math.random() > 0.5 ? 0xff4400 : 0xffaa00,
              groundY: baseY,
            });
          }
        }

        if (s.active) {
          const cx = s.sprite.x;
          const baseY = s.baseY;
          s.gfx.fillStyle(0xff6600, 0.4);
          s.gfx.fillEllipse(cx, baseY + 2, 24, 6);
          s.gfx.fillStyle(0xff8800, 0.3);
          s.gfx.fillEllipse(cx, baseY + 3, 32, 8);
        }
      }
    });

    if (this.lavaSplashGfx) {
      this.lavaSplashGfx.clear();
      for (let p = this.lavaSplashParticles.length - 1; p >= 0; p--) {
        const part = this.lavaSplashParticles[p];
        part.life += delta;
        part.x += part.vx * (delta / 1000);
        part.vy += 300 * (delta / 1000);
        part.y += part.vy * (delta / 1000);

        if (part.y >= part.groundY) {
          part.y = part.groundY;
          part.vy = 0;
          part.vx *= 0.8;
        }

        const alpha = 1 - part.life / part.maxLife;
        if (part.life >= part.maxLife) {
          this.lavaSplashParticles.splice(p, 1);
          continue;
        }
        this.lavaSplashGfx.fillStyle(part.color, alpha * 0.9);
        this.lavaSplashGfx.fillCircle(part.x, part.y, part.size * (0.5 + alpha * 0.5));
      }
    }
  }

  private updateLandslide(delta: number) {
    const playerBounds = this.player.getBounds();
    this.landslideData.forEach((ld) => {
      ld.timer += delta;
      const tx = ld.tile.x;
      const ty = ld.tile.y;
      const fullW = TILE * ld.tileWidth;
      const halfW = fullW / 2;
      const halfH = TILE / 4;

      ld.gfx.clear();

      const scrollOffset = (ld.timer * ld.speed * 0.008 * ld.dir) % 12;
      const chevronSpacing = 12;
      const chevronH = 5;
      const chevronW = 6;
      for (let i = -2; i < Math.ceil(fullW / chevronSpacing) + 2; i++) {
        const cx = tx - halfW + i * chevronSpacing + scrollOffset;
        if (cx < tx - halfW - chevronW || cx > tx + halfW) continue;
        const cy = ty;
        ld.gfx.fillStyle(0xccaa77, 0.6);
        if (ld.dir > 0) {
          ld.gfx.fillTriangle(cx, cy - chevronH, cx, cy + chevronH, cx + chevronW, cy);
        } else {
          ld.gfx.fillTriangle(cx + chevronW, cy - chevronH, cx + chevronW, cy + chevronH, cx, cy);
        }
      }

      ld.gfx.lineStyle(2, 0x4a2e18, 0.7);
      ld.gfx.strokeRect(tx - halfW, ty - halfH, fullW, halfH * 2);

      const tileBounds = ld.tile.getBounds();
      const expandedBounds = new Phaser.Geom.Rectangle(
        tileBounds.x, tileBounds.y - TILE * 0.5, tileBounds.width, tileBounds.height + TILE * 0.5
      );
      if (Phaser.Geom.Rectangle.Overlaps(playerBounds, expandedBounds)) {
        this.player.body.setVelocityX(this.player.body.velocity.x + ld.dir * ld.speed * 0.5);
      }
    });
  }

  private updateWaterBlock(delta: number) {
    const playerBounds = this.player.getBounds();
    let inWater = false;
    this.waterTimers.forEach((timer, block) => {
      const blockBounds = block.getBounds();
      if (Phaser.Geom.Rectangle.Overlaps(playerBounds, blockBounds)) {
        inWater = true;
        const newTimer = timer + delta;
        this.waterTimers.set(block, newTimer);
        this.player.body.setVelocityY(this.player.body.velocity.y + PHYSICS.QUICKSAND_SINK);
        if (newTimer > 1500) {
          this.handleDeath();
        }
      } else {
        this.waterTimers.set(block, 0);
      }
    });
  }

  private updateWaves(delta: number) {
    this.waveSpawnTimer += delta;
    this.oceanTimer += delta;
    if (this.waveSpawnTimer >= this.waveSpawnInterval) {
      this.waveSpawnTimer = 0;
      this.waveSpawnInterval = 2000 + Math.random() * 3000;
      this.spawnWave();
    }

    const playerBounds = this.player.getBounds();
    const camScrollY = this.cameras.main.scrollY;
    const gameH = this.cameras.main.height;
    const gameW = this.cameras.main.width;
    const screenBottom = camScrollY + gameH;

    if (this.oceanGfx) {
      this.oceanGfx.clear();
      const waterHeight = TILE * 2.5;
      const waterTop = gameH - waterHeight;

      this.oceanGfx.fillStyle(0x002244, 0.8);
      this.oceanGfx.fillRect(0, waterTop + 12, gameW, waterHeight);

      this.oceanGfx.fillStyle(0x003366, 0.7);
      this.oceanGfx.fillRect(0, waterTop + 18, gameW, waterHeight - 18);

      this.oceanGfx.fillStyle(0x004477, 0.6);
      this.oceanGfx.beginPath();
      this.oceanGfx.moveTo(0, gameH);
      for (let s = 0; s <= 40; s++) {
        const t = s / 40;
        const sx = t * gameW;
        const sy = waterTop + 8
          + Math.sin(this.oceanTimer * 0.002 + t * Math.PI * 4) * 4
          + Math.sin(this.oceanTimer * 0.0015 + t * Math.PI * 2) * 3;
        this.oceanGfx.lineTo(sx, sy);
      }
      this.oceanGfx.lineTo(gameW, gameH);
      this.oceanGfx.closePath();
      this.oceanGfx.fillPath();

      this.oceanGfx.fillStyle(0x0066aa, 0.5);
      this.oceanGfx.beginPath();
      this.oceanGfx.moveTo(0, gameH);
      for (let s = 0; s <= 40; s++) {
        const t = s / 40;
        const sx = t * gameW;
        const sy = waterTop + 16
          + Math.sin(this.oceanTimer * 0.0025 + t * Math.PI * 3 + 1) * 3
          + Math.sin(this.oceanTimer * 0.001 + t * Math.PI * 5) * 2;
        this.oceanGfx.lineTo(sx, sy);
      }
      this.oceanGfx.lineTo(gameW, gameH);
      this.oceanGfx.closePath();
      this.oceanGfx.fillPath();

      this.oceanGfx.lineStyle(1, 0x88ccff, 0.25);
      for (let r = 0; r < 3; r++) {
        const rippleY = waterTop + 24 + r * 14;
        this.oceanGfx.beginPath();
        this.oceanGfx.moveTo(0, rippleY);
        for (let s = 0; s <= 30; s++) {
          const t = s / 30;
          const sx = t * gameW;
          const sy = rippleY + Math.sin(this.oceanTimer * 0.003 + t * Math.PI * 6 + r * 2) * 2;
          this.oceanGfx.lineTo(sx, sy);
        }
        this.oceanGfx.strokePath();
      }
    }

    for (let i = this.activeWaves.length - 1; i >= 0; i--) {
      const w = this.activeWaves[i];
      w.life += delta;

      const progress = Math.min(w.life / w.maxLife, 1);
      w.x += w.speed * (delta / 1000);

      const waveW = TILE * 5;
      const waveH = TILE * 4;
      const cx = w.x;
      const bottom = screenBottom + 4;
      const waveTop = bottom - waveH;
      const left = cx - waveW / 2;
      const segments = 24;

      const fadeIn = Math.min(w.life / 500, 1);
      const fadeOut = progress > 0.85 ? 1 - (progress - 0.85) / 0.15 : 1;
      const alpha = fadeIn * fadeOut;

      w.gfx.clear();

      w.gfx.fillStyle(0x003855, 0.6 * alpha);
      w.gfx.beginPath();
      w.gfx.moveTo(left, bottom);
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const sx = left + t * waveW;
        const sy = waveTop + waveH * 0.55 + Math.sin(w.life * 0.003 + t * Math.PI * 2) * 6;
        w.gfx.lineTo(sx, sy);
      }
      w.gfx.lineTo(left + waveW, bottom);
      w.gfx.closePath();
      w.gfx.fillPath();

      w.gfx.fillStyle(0x005f8f, 0.65 * alpha);
      w.gfx.beginPath();
      w.gfx.moveTo(left, bottom);
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const sx = left + t * waveW;
        const baseAmp = 8 + Math.sin(t * Math.PI) * 6;
        const sy = waveTop + waveH * 0.4 + Math.sin(w.life * 0.004 + t * Math.PI * 2) * baseAmp;
        w.gfx.lineTo(sx, sy);
      }
      w.gfx.lineTo(left + waveW, bottom);
      w.gfx.closePath();
      w.gfx.fillPath();

      w.gfx.fillStyle(0x0088cc, 0.75 * alpha);
      w.gfx.beginPath();
      w.gfx.moveTo(left, bottom);
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const sx = left + t * waveW;
        const curlFactor = Math.pow(Math.sin(t * Math.PI), 2);
        const crestH = 12 * curlFactor;
        const sy = waveTop + waveH * 0.25
          + Math.sin(w.life * 0.005 + t * Math.PI * 2.5) * (5 + crestH)
          - crestH * Math.sin(w.life * 0.003);
        w.gfx.lineTo(sx, sy);
      }
      w.gfx.lineTo(left + waveW, bottom);
      w.gfx.closePath();
      w.gfx.fillPath();

      w.gfx.fillStyle(0x00bbff, 0.85 * alpha);
      w.gfx.beginPath();
      const crestStart = 0.1;
      const crestEnd = 0.7;
      const crestBaseY = waveTop + waveH * 0.18;
      w.gfx.moveTo(left + crestStart * waveW, crestBaseY + 12);
      for (let s = 0; s <= 20; s++) {
        const t = crestStart + (s / 20) * (crestEnd - crestStart);
        const sx = left + t * waveW;
        const curl = Math.sin((t - crestStart) / (crestEnd - crestStart) * Math.PI);
        const sy = crestBaseY - curl * 20 * Math.abs(Math.sin(w.life * 0.004))
          + Math.sin(w.life * 0.007 + t * 8) * 2;
        w.gfx.lineTo(sx, sy);
      }
      for (let s = 20; s >= 0; s--) {
        const t = crestStart + (s / 20) * (crestEnd - crestStart);
        const sx = left + t * waveW;
        const curl = Math.sin((t - crestStart) / (crestEnd - crestStart) * Math.PI);
        const sy = crestBaseY + 6 - curl * 6;
        w.gfx.lineTo(sx, sy);
      }
      w.gfx.closePath();
      w.gfx.fillPath();

      w.gfx.fillStyle(0xffffff, 0.7 * alpha);
      for (let f = 0; f < 8; f++) {
        const ft = crestStart + 0.03 + (f / 8) * (crestEnd - crestStart - 0.06);
        const fx = left + ft * waveW;
        const foamY = crestBaseY - Math.sin((ft - crestStart) / (crestEnd - crestStart) * Math.PI) * 14
          + Math.sin(w.life * 0.008 + f * 2) * 3;
        const foamSize = 2.5 + Math.sin(w.life * 0.006 + f) * 1.5;
        w.gfx.fillCircle(fx, foamY, foamSize);
      }

      w.gfx.lineStyle(1.5, 0xffffff, 0.3 * alpha);
      for (let r = 0; r < 2; r++) {
        const rippleY = waveTop + waveH * (0.5 + r * 0.18);
        w.gfx.beginPath();
        w.gfx.moveTo(left + waveW * 0.05, rippleY);
        for (let s = 0; s <= 14; s++) {
          const t = s / 14;
          const sx = left + waveW * 0.05 + t * waveW * 0.9;
          const sy = rippleY + Math.sin(w.life * 0.005 + t * Math.PI * 3 + r * 1.5) * 3;
          w.gfx.lineTo(sx, sy);
        }
        w.gfx.strokePath();
      }

      const hitLeft = cx - waveW / 2;
      const hitTop = waveTop + waveH * 0.15;
      const hitW = waveW;
      const hitH = waveH * 0.6;
      const hitRect = new Phaser.Geom.Rectangle(hitLeft, hitTop, hitW, hitH);
      if (Phaser.Geom.Rectangle.Overlaps(playerBounds, hitRect)) {
        w.catching = true;
        if (!this.isDucking) {
          this.player.body.setVelocityX(w.speed * 0.9);
          this.player.body.setVelocityY(Math.min(this.player.body.velocity.y, -40));
        }
      } else {
        w.catching = false;
      }

      if (w.life >= w.maxLife) {
        w.gfx.destroy();
        this.activeWaves.splice(i, 1);
      }
    }
  }

  private spawnWave() {
    const camX = this.cameras.main.scrollX;
    const camW = this.cameras.main.width;

    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? camX - TILE * 6 : camX + camW + TILE * 6;
    const travelDist = (camW + TILE * 14) * (fromLeft ? 1 : -1);
    const speed = (fromLeft ? 1 : -1) * (PHYSICS.WAVE_SPEED * (0.7 + Math.random() * 0.6));
    const targetX = startX + travelDist;
    const maxLife = Math.abs(travelDist / speed) * 1000;

    const gfx = this.add.graphics().setDepth(50);

    this.activeWaves.push({
      gfx,
      x: startX,
      y: 0,
      targetX,
      speed,
      life: 0,
      maxLife,
      catching: false,
    });
  }

  private updateVineSwings(delta: number) {
    this.vineSwings.forEach((v) => {
      v.angle += delta * 0.002;
      const offsetX = Math.sin(v.angle) * PHYSICS.VINE_SWING_RANGE;
      v.pivot.x = v.baseX + offsetX;
      v.platform.x = v.baseX + offsetX;
      (v.platform.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    });
  }

  private updateTankPush() {
    const playerBounds = this.player.getBounds();
    this.tankPushers.forEach((t) => {
      const tankBounds = t.rect.getBounds();
      if (Phaser.Geom.Rectangle.Overlaps(playerBounds, tankBounds)) {
        this.player.body.setVelocityX(this.player.body.velocity.x + PHYSICS.TANK_SPEED * t.dir * 0.1);
      }
    });
  }

  private updateBullets(delta: number) {
    if (!this.bullets) return;
    this.bulletTimer += delta;
    if (this.bulletTimer > 3000) {
      this.bulletTimer = 0;
      const bx = this.player.x + 400;
      const by = this.player.y - 20 + Math.random() * 40;
      const bullet = this.add.rectangle(bx, by, 12, 4, 0xff0000);
      this.bullets.add(bullet);
      (bullet.body as Phaser.Physics.Arcade.Body).setVelocityX(-PHYSICS.BULLET_SPEED);
      (bullet.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      this.time.delayedCall(5000, () => bullet.destroy());
    }
  }

  private checkCheckpoints() {
    this.checkpoints.forEach((cp) => {
      if (!cp.reached && Math.abs(this.player.x - cp.x) < TILE && Math.abs(this.player.y - cp.y) < TILE * 3) {
        cp.reached = true;
        this.lastCheckpointX = cp.x + TILE * 1.5;
        this.lastCheckpointY = cp.y;
        const flag = cp.marker.list[1] as Phaser.GameObjects.Triangle;
        flag.setFillStyle(0x00ff00);
        this.tweens.add({
          targets: cp.marker,
          scaleX: 1.3,
          scaleY: 1.3,
          duration: 200,
          yoyo: true,
        });
      }
    });
  }

  private handleDeath() {
    if (this.isDead) return;
    this.isDead = true;
    this.deaths++;
    this.deathText.setText(`Deaths: ${this.deaths}`);

    this.cameras.main.shake(200, 0.01);
    this.cameras.main.flash(200, 255, 0, 0);

    this.time.delayedCall(400, () => {
      this.player.x = this.lastCheckpointX;
      this.player.y = this.lastCheckpointY;
      this.player.body.setVelocity(0, 0);
      this.isDead = false;
      if (this.isDucking) {
        this.isDucking = false;
        this.player.setSize(28, PHYSICS.NORMAL_HEIGHT);
        this.player.body.setSize(28, PHYSICS.NORMAL_HEIGHT);
      }
    });
  }

  private completeWorld() {
    markWorldCompleted(this.worldIndex, this.deaths);
    if (allWorldsCompleted()) {
      this.scene.start("WinScene", { deaths: this.deaths, startTime: this.startTime });
    } else {
      this.scene.start("TitleScene");
    }
  }

  private togglePause() {
    if (this.isPaused) {
      this.unpause();
    } else {
      this.pause();
    }
  }

  private pause() {
    if (this.isPaused || this.isDead) return;
    this.isPaused = true;
    this.physics.world.pause();
    this.tweens.pauseAll();

    const { width, height } = this.cameras.main;
    const scrollX = this.cameras.main.scrollX;
    const scrollY = this.cameras.main.scrollY;
    const cx = scrollX + width / 2;
    const cy = scrollY + height / 2;

    this.pauseContainer = this.add.container(cx, cy).setDepth(500);

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7);
    this.pauseContainer.add(overlay);

    const titleText = this.add.text(0, -80, "PAUSED", {
      fontSize: "42px",
      fontFamily: "monospace",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.pauseContainer.add(titleText);

    const btnW = 200;
    const btnH = 44;
    const buttons = [
      { label: "Unpause", y: -10, action: () => this.unpause() },
      { label: "Restart", y: 50, action: () => this.restartWorld() },
      { label: "Home", y: 110, action: () => this.goHome() },
    ];

    buttons.forEach((btn) => {
      const bg = this.add.rectangle(0, btn.y, btnW, btnH, 0x16213e, 0.95);
      bg.setStrokeStyle(2, 0x0f3460);
      bg.setInteractive({ useHandCursor: true });

      const label = this.add.text(0, btn.y, btn.label, {
        fontSize: "18px",
        fontFamily: "monospace",
        color: "#cccccc",
      }).setOrigin(0.5);

      bg.on("pointerover", () => {
        bg.setFillStyle(0x1e2d4a, 1);
        label.setColor("#ffffff");
      });
      bg.on("pointerout", () => {
        bg.setFillStyle(0x16213e, 0.95);
        label.setColor("#cccccc");
      });
      bg.on("pointerdown", btn.action);

      this.pauseContainer!.add([bg, label]);
    });
  }

  private unpause() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.physics.world.resume();
    this.tweens.resumeAll();
    if (this.pauseContainer) {
      this.pauseContainer.destroy();
      this.pauseContainer = null;
    }
  }

  private restartWorld() {
    this.isPaused = false;
    this.physics.world.resume();
    this.tweens.resumeAll();
    this.scene.restart({ worldIndex: this.worldIndex, deaths: 0, startTime: Date.now() });
  }

  private goHome() {
    this.isPaused = false;
    this.physics.world.resume();
    this.tweens.resumeAll();
    this.scene.start("TitleScene");
  }
}
