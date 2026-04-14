import Phaser from "phaser";
import { WORLDS, TILE, LEVEL_WIDTH, PHYSICS, CHECKPOINT_COUNT } from "../worlds/WorldConfig";
import { generateLevel, type LevelTile } from "../worlds/LevelGenerator";

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
  private sprayTimers: { sprite: Phaser.GameObjects.Rectangle; timer: number; active: boolean; baseY: number; gfx?: Phaser.GameObjects.Graphics; dome?: Phaser.GameObjects.Graphics }[] = [];
  private landslideData: { tile: Phaser.GameObjects.Rectangle; dir: number; speed: number; gfx: Phaser.GameObjects.Graphics; timer: number }[] = [];
  private activeWaves: { gfx: Phaser.GameObjects.Graphics; x: number; y: number; targetX: number; speed: number; life: number; maxLife: number; catching: boolean }[] = [];
  private waveSpawnTimer: number = 0;
  private waveSpawnInterval: number = 2500;
  private oceanGfx: Phaser.GameObjects.Graphics | null = null;
  private oceanTimer: number = 0;
  private vineSwings: { pivot: Phaser.GameObjects.Rectangle; platform: Phaser.GameObjects.Rectangle; angle: number; baseX: number }[] = [];
  private tankPushers: { rect: Phaser.GameObjects.Rectangle; dir: number }[] = [];
  private bullets: Phaser.Physics.Arcade.Group | null = null;
  private bulletTimer: number = 0;

  constructor() {
    super({ key: "GameScene" });
  }

  create(data: { worldIndex: number; deaths: number; startTime: number }) {
    this.worldIndex = data.worldIndex;
    this.deaths = data.deaths;
    this.startTime = data.startTime;
    this.isDead = false;
    this.isDucking = false;
    this.checkpoints = [];
    this.waterTimers = new Map();
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

    this.physics.add.overlap(this.player, this.killGroup, () => this.handleDeath(), undefined, this);
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

    this.worldText = this.add.text(16, 16, world.name, {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#ffffff",
    }).setScrollFactor(0).setDepth(100);

    this.deathText = this.add.text(784, 16, `Deaths: ${this.deaths}`, {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#e94560",
    }).setScrollFactor(0).setOrigin(1, 0).setDepth(100);

    if (this.worldIndex === 3) {
      this.bullets = this.physics.add.group({ allowGravity: false });
      this.physics.add.overlap(this.player, this.bullets, () => this.handleDeath(), undefined, this);
    }

    if (this.worldIndex === 1) {
      this.oceanGfx = this.add.graphics().setDepth(45).setScrollFactor(0);
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
            const k = this.add.rectangle(px, py - TILE, TILE, TILE, world.killBlockColor, 0.7);
            this.killGroup.add(k);
            (k.body as Phaser.Physics.Arcade.StaticBody).setSize(TILE, TILE);
            this.waterTimers.set(k, 0);
          } else if (this.worldIndex === 0) {
            const k = this.add.rectangle(px, py, TILE, TILE, world.killBlockColor);
            this.killGroup.add(k);
            (k.body as Phaser.Physics.Arcade.StaticBody).setSize(TILE, TILE);
            const speckleGfx = this.add.graphics();
            const speckSeed = (tile.x * 73 + tile.y * 137) % 1000;
            const speckRng = (i: number) => ((speckSeed + i * 397) % 1000) / 1000;
            for (let i = 0; i < 8; i++) {
              const sx = px - TILE / 2 + speckRng(i) * TILE;
              const sy = py - TILE / 2 + speckRng(i + 10) * TILE;
              const size = 1.5 + speckRng(i + 20) * 2.5;
              const color = speckRng(i + 30) > 0.5 ? 0xffdd00 : 0xffee55;
              speckleGfx.fillStyle(color, 0.8);
              speckleGfx.fillRect(sx - size / 2, sy - size / 2, size, size);
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
          this.createMovement(px, py, world, tile.x);
          break;
        }
        case "checkpoint": {
          const container = this.add.container(px, py);
          const pole = this.add.rectangle(0, 8, 4, 40, 0xcccccc);
          const flag = this.add.triangle(6, -4, 0, 0, 0, 16, 16, 8, world.checkpointColor);
          container.add([pole, flag]);
          this.checkpoints.push({ x: px, y: py, reached: false, marker: container });
          break;
        }
      }
    });
  }

  private createSpike(px: number, py: number, world: typeof WORLDS[0]) {
    switch (this.worldIndex) {
      case 0: {
        const spray = this.add.rectangle(px, py, 12, 4, world.spikeColor, 0);
        this.spikeGroup.add(spray);
        (spray.body as Phaser.Physics.Arcade.Body).setSize(12, 4);
        spray.setVisible(false);
        const dome = this.add.graphics();
        dome.fillStyle(0xaa0000, 0.7);
        dome.fillEllipse(px, py + 2, 14, 8);
        dome.fillStyle(0xcc2200, 0.5);
        dome.fillEllipse(px, py + 1, 10, 5);
        const sprayGfx = this.add.graphics();
        this.sprayTimers.push({ sprite: spray, timer: 0, active: false, baseY: py, gfx: sprayGfx, dome });
        break;
      }
      case 1: {
        const shard = this.add.triangle(px, py, 0, 12, 6, 0, 12, 12, world.spikeColor);
        shard.setStrokeStyle(1, 0xffffff, 0.5);
        this.spikeGroup.add(shard);
        (shard.body as Phaser.Physics.Arcade.Body).setSize(12, 12);
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

  private createMovement(px: number, py: number, world: typeof WORLDS[0], tileX: number) {
    switch (this.worldIndex) {
      case 0: {
        const slide = this.add.rectangle(px, py, TILE, TILE, world.movementColor);
        slide.setStrokeStyle(2, 0x4a2e18);
        this.movementGroup.add(slide);
        (slide.body as Phaser.Physics.Arcade.StaticBody).setSize(TILE, TILE);
        const dir = tileX % 2 === 0 ? 1 : -1;
        const speedVariants = [0.6, 0.8, 1.0, 1.3, 1.6];
        const speedIdx = (tileX * 31 + 7) % speedVariants.length;
        const speed = PHYSICS.LANDSLIDE_BOOST * speedVariants[speedIdx];
        const gfx = this.add.graphics();
        this.landslideData.push({ tile: slide, dir, speed, gfx, timer: 0 });
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
      this.isDucking = false;
      this.player.setSize(28, PHYSICS.NORMAL_HEIGHT);
      this.player.body.setSize(28, PHYSICS.NORMAL_HEIGHT);
      this.player.y -= (PHYSICS.NORMAL_HEIGHT - PHYSICS.DUCK_HEIGHT) / 2;
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
        }
      }
    });
  }

  private updateLandslide(delta: number) {
    const playerBounds = this.player.getBounds();
    this.landslideData.forEach((ld) => {
      ld.timer += delta;
      const tx = ld.tile.x;
      const ty = ld.tile.y;
      const half = TILE / 2;

      ld.gfx.clear();
      ld.gfx.fillStyle(0x7a5230, 0.4);
      const scrollOffset = (ld.timer * ld.speed * 0.003 * ld.dir) % TILE;
      const chevronSpacing = 10;
      for (let i = -2; i < 5; i++) {
        const cx = tx - half + i * chevronSpacing + scrollOffset;
        if (cx < tx - half || cx > tx + half - 4) continue;
        const cy = ty;
        ld.gfx.fillStyle(0xccaa77, 0.5);
        if (ld.dir > 0) {
          ld.gfx.fillTriangle(cx, cy - 4, cx, cy + 4, cx + 5, cy);
        } else {
          ld.gfx.fillTriangle(cx + 5, cy - 4, cx + 5, cy + 4, cx, cy);
        }
      }

      ld.gfx.lineStyle(1, 0x4a2e18, 0.6);
      ld.gfx.strokeRect(tx - half, ty - half, TILE, TILE);

      const tileBounds = ld.tile.getBounds();
      if (Phaser.Geom.Rectangle.Overlaps(playerBounds, tileBounds)) {
        this.player.body.setVelocityX(this.player.body.velocity.x + ld.dir * ld.speed * 0.08);
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
        this.player.body.setVelocityX(w.speed * 0.9);
        this.player.body.setVelocityY(Math.min(this.player.body.velocity.y, -40));
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
        this.lastCheckpointX = cp.x;
        this.lastCheckpointY = cp.y + TILE;
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
    if (this.worldIndex >= WORLDS.length - 1) {
      this.scene.start("WinScene", { deaths: this.deaths, startTime: this.startTime });
    } else {
      this.scene.start("WarningScene", {
        worldIndex: this.worldIndex + 1,
        deaths: this.deaths,
        startTime: this.startTime,
      });
    }
  }
}
