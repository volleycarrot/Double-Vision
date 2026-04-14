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
  private sprayTimers: { sprite: Phaser.GameObjects.Rectangle; timer: number; active: boolean; baseY: number }[] = [];
  private waveZones: { gfx: Phaser.GameObjects.Graphics; hitRect: Phaser.Geom.Rectangle; timer: number; baseX: number; baseY: number; color: number; alpha: number }[] = [];
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
    this.waveZones = [];
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
        const spray = this.add.rectangle(px, py, 8, 4, world.spikeColor);
        this.spikeGroup.add(spray);
        (spray.body as Phaser.Physics.Arcade.Body).setSize(8, 4);
        spray.setVisible(false);
        this.sprayTimers.push({ sprite: spray, timer: Math.random() * 4000, active: false, baseY: py });
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
        slide.setStrokeStyle(1, 0x654321);
        this.movementGroup.add(slide);
        (slide.body as Phaser.Physics.Arcade.StaticBody).setSize(TILE, TILE);
        const arrow = this.add.text(px, py, tileX % 2 === 0 ? ">" : "<", {
          fontSize: "16px",
          fontFamily: "monospace",
          color: "#ffffff",
        }).setOrigin(0.5).setAlpha(0.5);
        break;
      }
      case 1: {
        const waveGfx = this.add.graphics();
        const waveBaseX = px;
        const waveBaseY = py - TILE;
        const hitRect = new Phaser.Geom.Rectangle(waveBaseX - TILE, waveBaseY - TILE, TILE * 2, TILE * 2);
        this.waveZones.push({ gfx: waveGfx, hitRect, timer: 0, baseX: waveBaseX, baseY: waveBaseY, color: world.movementColor, alpha: 0.3 });
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
        this.updateLandslide();
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
      const cycle = s.timer % 4000;
      if (cycle < 2000 && !s.active) {
        s.active = true;
        s.sprite.setVisible(true);
        s.sprite.setSize(8, 48);
        (s.sprite.body as Phaser.Physics.Arcade.Body).setSize(8, 48);
        s.sprite.y = s.baseY - 24;
      } else if (cycle >= 2000 && s.active) {
        s.active = false;
        s.sprite.setVisible(false);
        s.sprite.setSize(8, 4);
        (s.sprite.body as Phaser.Physics.Arcade.Body).setSize(8, 4);
        s.sprite.y = s.baseY;
      }
    });
  }

  private updateLandslide() {
    const playerBounds = this.player.getBounds();
    this.movementGroup.getChildren().forEach((child) => {
      const tile = child as Phaser.GameObjects.Rectangle;
      const tileBounds = tile.getBounds();
      if (Phaser.Geom.Rectangle.Overlaps(playerBounds, tileBounds)) {
        const dir = (tile.x > this.player.x) ? PHYSICS.LANDSLIDE_BOOST : -PHYSICS.LANDSLIDE_BOOST;
        this.player.body.setVelocityX(this.player.body.velocity.x + dir * 0.05);
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
    const playerBounds = this.player.getBounds();
    this.waveZones.forEach((w) => {
      w.timer += delta;
      const sway = Math.sin(w.timer * 0.003) * 10;

      w.gfx.clear();
      const waveWidth = TILE * 2;
      const waveHeight = TILE * 2;
      const cx = w.baseX + sway;
      const cy = w.baseY;
      const left = cx - waveWidth / 2;
      const top = cy - waveHeight / 2;

      w.gfx.fillStyle(w.color, w.alpha);
      w.gfx.beginPath();
      w.gfx.moveTo(left, top + waveHeight);
      const segments = 20;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const sx = left + t * waveWidth;
        const amp = 6 + Math.sin(w.timer * 0.004 + t * Math.PI * 2) * 3;
        const sy = top + Math.sin(w.timer * 0.005 + t * Math.PI * 3) * amp;
        w.gfx.lineTo(sx, sy);
      }
      w.gfx.lineTo(left + waveWidth, top + waveHeight);
      w.gfx.closePath();
      w.gfx.fillPath();

      w.gfx.lineStyle(2, w.color, w.alpha + 0.2);
      w.gfx.beginPath();
      w.gfx.moveTo(left, top + waveHeight * 0.3);
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const sx = left + t * waveWidth;
        const sy = top + waveHeight * 0.3 + Math.sin(w.timer * 0.006 + t * Math.PI * 2.5) * 5;
        w.gfx.lineTo(sx, sy);
      }
      w.gfx.strokePath();

      w.hitRect.x = cx - waveWidth / 2;
      w.hitRect.y = cy - waveHeight / 2;

      if (Phaser.Geom.Rectangle.Overlaps(playerBounds, w.hitRect)) {
        this.player.body.setVelocityX(this.player.body.velocity.x + PHYSICS.WAVE_SPEED * 0.45);
      }
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
